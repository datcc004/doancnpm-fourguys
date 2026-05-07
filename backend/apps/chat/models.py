from django.conf import settings
from django.db import models


class ChatConversation(models.Model):
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='chat_conversations',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chat_conversations'
        ordering = ['-updated_at']
        verbose_name = 'Cuoc tro chuyen'
        verbose_name_plural = 'Cuoc tro chuyen'

    def __str__(self):
        names = ', '.join(self.participants.values_list('username', flat=True)[:3])
        return names or f'Conversation #{self.pk}'


class ChatMessage(models.Model):
    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_chat_messages',
    )
    content = models.TextField()
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ['created_at']
        verbose_name = 'Tin nhan'
        verbose_name_plural = 'Tin nhan'
        indexes = [
            models.Index(fields=['conversation', 'created_at'], name='chat_msg_conv_time_idx'),
            models.Index(fields=['sender', 'read_at'], name='chat_msg_sender_read_idx'),
        ]

    def __str__(self):
        return f'{self.sender_id}: {self.content[:40]}'
