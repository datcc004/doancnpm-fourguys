from django.contrib import admin
from .models import Course, ClassRoom, Enrollment, TestScore, BlogPost, Scholarship

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'language', 'level', 'tuition_fee', 'is_active']
    list_filter = ['language', 'level', 'is_active']
    search_fields = ['name', 'code']

@admin.register(ClassRoom)
class ClassRoomAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'course', 'teacher', 'status', 'start_date', 'end_date']
    list_filter = ['status', 'course']
    search_fields = ['name', 'code']

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['student', 'classroom', 'enrollment_date', 'status', 'payment_status', 'approval_status', 'deposit_amount']
    list_filter = ['status', 'payment_status', 'approval_status']
    search_fields = ['student__user__first_name', 'student__user__last_name']

@admin.register(TestScore)
class TestScoreAdmin(admin.ModelAdmin):
    list_display = ['student', 'classroom', 'test_name', 'test_type', 'score', 'max_score', 'test_date']
    list_filter = ['test_type', 'classroom']
    search_fields = ['student__user__first_name', 'student__user__last_name', 'test_name']


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ['title', 'slug', 'is_published', 'published_at', 'created_at']
    list_filter = ['is_published', 'published_at']
    search_fields = ['title', 'excerpt', 'content']
    prepopulated_fields = {'slug': ['title']}


@admin.register(Scholarship)
class ScholarshipAdmin(admin.ModelAdmin):
    list_display = ['title', 'amount_text', 'deadline', 'is_published', 'published_at']
    list_filter = ['is_published', 'published_at', 'deadline']
    search_fields = ['title', 'short_description', 'content', 'eligibility']
    prepopulated_fields = {'slug': ['title']}
