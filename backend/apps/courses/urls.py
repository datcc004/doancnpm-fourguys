"""
URLs - Routing cho courses API
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'list', views.CourseViewSet, basename='course')
router.register(r'classes', views.ClassRoomViewSet, basename='classroom')
router.register(r'enrollments', views.EnrollmentViewSet, basename='enrollment')
router.register(r'scores', views.TestScoreViewSet, basename='testscore')
router.register(r'materials', views.CourseMaterialViewSet, basename='coursematerial')

urlpatterns = [
    path('', include(router.urls)),
]

