from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'conversations', views.ChatConversationViewSet, basename='chat-conversation')

urlpatterns = [
    path('users/', views.ChatUserListView.as_view(), name='chat-users'),
    path('unread-count/', views.unread_count, name='chat-unread-count'),
    path('ai/', views.ai_chat, name='chat-ai'),
    path('', include(router.urls)),
]
