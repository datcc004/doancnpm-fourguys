"""
URL Configuration - Hệ thống quản lý trung tâm ngoại ngữ
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from django.http import JsonResponse

def api_root_view(request):
    return JsonResponse({
        "status": "success",
        "message": "Language Center API is running successfully.",
        "endpoints": {
            "auth": "/api/auth/",
            "courses": "/api/courses/",
            "payments": "/api/payments/",
            "attendance": "/api/attendance/",
            "chat": "/api/chat/",
            "admin": "/admin/"
        }
    })

urlpatterns = [
    path('', api_root_view, name='api-root'),
    path('api/', api_root_view),
    path('admin/', admin.site.urls),
    # API Routes
    path('api/auth/', include('apps.accounts.urls')),
    path('api/courses/', include('apps.courses.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/chat/', include('apps.chat.urls')),
]

# Serve media files trong development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
