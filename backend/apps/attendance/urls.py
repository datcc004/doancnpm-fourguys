from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'sessions', views.AttendanceSessionViewSet, basename='attendance-session')
router.register(r'records', views.AttendanceRecordViewSet, basename='attendance-record')
router.register(
    r'teacher-attendance',
    views.TeacherAttendanceViewSet,
    basename='teacher-attendance',
)

urlpatterns = [
    path('', include(router.urls)),
]
