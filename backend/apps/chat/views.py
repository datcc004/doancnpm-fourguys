import json
import os
import urllib.error
import urllib.request

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import ChatConversation, ChatMessage
from .serializers import (
    ChatConversationCreateSerializer,
    ChatConversationSerializer,
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    ChatUserSerializer,
)


def _build_ai_prompt(user, message, history):
    history_lines = []
    for item in history[-10:]:
        content = str(item.get('content', '')).strip()
        if not content:
            continue
        role = 'User' if item.get('is_mine') else 'AI'
        history_lines.append(f'{role}: {content[:1000]}')

    history_text = '\n'.join(history_lines) or 'No previous messages.'
    display_name = user.get_full_name() or user.username
    return (
        'Ban la tro ly AI cho he thong quan ly trung tam ngoai ngu. '
        'Tra loi bang tieng Viet, ngan gon, lich su va huu ich. '
        'Neu cau hoi lien quan du lieu noi bo ma ban khong duoc cung cap, hay noi ro la can kiem tra trong he thong.\n\n'
        f'Nguoi dung: {display_name}\n'
        f'Lich su gan day:\n{history_text}\n\n'
        f'Cau hoi moi: {message}'
    )


def _extract_gemini_text(data):
    parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
    texts = [part.get('text', '') for part in parts if part.get('text')]
    return '\n'.join(texts).strip()


def _generate_gemini_reply(api_key, model, prompt):
    payload = {
        'contents': [
            {
                'parts': [
                    {'text': prompt},
                ],
            },
        ],
        'generationConfig': {
            'temperature': 0.4,
            'maxOutputTokens': 800,
        },
    }
    request = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'x-goog-api-key': api_key,
        },
        method='POST',
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.loads(response.read().decode('utf-8'))
    return _extract_gemini_text(data)


class ChatUserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = User.objects.filter(is_active=True).exclude(id=request.user.id).order_by(
            'role',
            'last_name',
            'first_name',
            'username',
        )

        role = request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        serializer = ChatUserSerializer(queryset[:100], many=True, context={'request': request})
        return Response(serializer.data)


class ChatConversationViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _queryset(self):
        return (
            ChatConversation.objects.filter(participants=self.request.user)
            .prefetch_related('participants', 'messages__sender')
            .distinct()
            .order_by('-updated_at')
        )

    def _get_object(self, pk):
        try:
            return self._queryset().get(pk=pk)
        except ChatConversation.DoesNotExist:
            return None

    def list(self, request):
        serializer = ChatConversationSerializer(
            self._queryset(),
            many=True,
            context={'request': request},
        )
        return Response(serializer.data)

    @transaction.atomic
    def create(self, request):
        serializer = ChatConversationCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        recipient = User.objects.get(id=serializer.validated_data['recipient_id'])
        conversation = (
            ChatConversation.objects.filter(participants=request.user)
            .filter(participants=recipient)
            .annotate(participant_count=Count('participants', distinct=True))
            .filter(participant_count=2)
            .first()
        )

        if conversation is None:
            conversation = ChatConversation.objects.create()
            conversation.participants.add(request.user, recipient)

        initial_message = serializer.validated_data.get('initial_message', '').strip()
        if initial_message:
            ChatMessage.objects.create(
                conversation=conversation,
                sender=request.user,
                content=initial_message,
            )
            conversation.updated_at = timezone.now()
            conversation.save(update_fields=['updated_at'])

        output = ChatConversationSerializer(conversation, context={'request': request})
        return Response(output.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        conversation = self._get_object(pk)
        if conversation is None:
            return Response({'detail': 'Khong tim thay hoi thoai.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ChatConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    @transaction.atomic
    def messages(self, request, pk=None):
        conversation = self._get_object(pk)
        if conversation is None:
            return Response({'detail': 'Khong tim thay hoi thoai.'}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'POST':
            serializer = ChatMessageCreateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            message = ChatMessage.objects.create(
                conversation=conversation,
                sender=request.user,
                content=serializer.validated_data['content'],
            )
            conversation.updated_at = timezone.now()
            conversation.save(update_fields=['updated_at'])
            output = ChatMessageSerializer(message, context={'request': request})
            return Response(output.data, status=status.HTTP_201_CREATED)

        conversation.messages.exclude(sender=request.user).filter(read_at__isnull=True).update(
            read_at=timezone.now()
        )
        messages = conversation.messages.select_related('sender').order_by('created_at')
        serializer = ChatMessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    count = ChatMessage.objects.filter(
        conversation__participants=request.user,
        read_at__isnull=True,
    ).exclude(sender=request.user).count()
    return Response({'unread_count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_chat(request):
    message = str(request.data.get('message', '')).strip()
    if not message:
        return Response({'detail': 'Vui long nhap noi dung.'}, status=status.HTTP_400_BAD_REQUEST)

    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return Response(
            {'detail': 'Chua cau hinh GEMINI_API_KEY tren backend.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    history = request.data.get('history', [])
    if not isinstance(history, list):
        history = []

    prompt = _build_ai_prompt(request.user, message, history)
    model = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash-lite')

    try:
        reply = _generate_gemini_reply(api_key, model, prompt)
    except urllib.error.HTTPError as exc:
        detail = 'Khong the ket noi Gemini. Vui long kiem tra API key hoac quota.'
        if exc.code == 400:
            detail = 'Gemini khong chap nhan yeu cau. Vui long kiem tra ten model.'
        elif exc.code in (401, 403):
            detail = 'Gemini API key khong hop le hoac chua duoc cap quyen.'
        elif exc.code == 429:
            detail = 'Gemini da het quota mien phi hoac bi gioi han toc do.'
        return Response({'detail': detail}, status=status.HTTP_502_BAD_GATEWAY)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return Response(
            {'detail': 'Khong the ket noi Gemini. Vui long kiem tra API key hoac quota.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    reply = reply or 'Xin loi, toi chua co cau tra loi.'
    return Response({'reply': reply})
