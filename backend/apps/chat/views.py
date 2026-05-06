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
