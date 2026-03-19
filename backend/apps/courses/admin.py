from django.contrib import admin
from .models import Course, ClassRoom, Enrollment

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
    list_display = ['student', 'classroom', 'enrollment_date', 'status', 'final_grade']
    list_filter = ['status']
