from rest_framework import serializers

from apps.accounts.models import User

from .models import ChatConversation, ChatMessage


class ChatUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'role', 'avatar_url']

    def get_full_name(self, obj):
        full_name = obj.get_full_name().strip()
        return full_name or obj.username

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ['id', 'conversation', 'sender', 'content', 'read_at', 'created_at', 'is_mine']
        read_only_fields = ['id', 'conversation', 'sender', 'read_at', 'created_at', 'is_mine']

    def get_is_mine(self, obj):
        request = self.context.get('request')
        return bool(request and request.user and obj.sender_id == request.user.id)


class ChatMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError('Noi dung tin nhan khong duoc de trong.')
        return value.strip()


class ChatConversationSerializer(serializers.ModelSerializer):
    participants = ChatUserSerializer(many=True, read_only=True)
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatConversation
        fields = [
            'id',
            'participants',
            'other_participant',
            'last_message',
            'unread_count',
            'created_at',
            'updated_at',
        ]

    def _request_user(self):
        request = self.context.get('request')
        return request.user if request else None

    def get_other_participant(self, obj):
        user = self._request_user()
        participant = obj.participants.exclude(id=getattr(user, 'id', None)).first()
        return ChatUserSerializer(participant, context=self.context).data if participant else None

    def get_last_message(self, obj):
        message = obj.messages.select_related('sender').order_by('-created_at').first()
        return ChatMessageSerializer(message, context=self.context).data if message else None

    def get_unread_count(self, obj):
        user = self._request_user()
        if not user or not user.is_authenticated:
            return 0
        return obj.messages.exclude(sender=user).filter(read_at__isnull=True).count()


class ChatConversationCreateSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField()
    initial_message = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    def validate_recipient_id(self, value):
        request = self.context.get('request')
        if request and value == request.user.id:
            raise serializers.ValidationError('Khong the tao hoi thoai voi chinh minh.')
        if not User.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError('Nguoi nhan khong ton tai hoac da bi khoa.')
        return value
