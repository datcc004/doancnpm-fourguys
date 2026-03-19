from django.contrib import admin
from .models import User, Student, Teacher

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role', 'is_active', 'created_at']
    list_filter = ['role', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['student_code', 'user', 'level', 'enrollment_date']
    search_fields = ['student_code', 'user__first_name', 'user__last_name']

@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['teacher_code', 'user', 'specialization', 'experience_years']
    search_fields = ['teacher_code', 'user__first_name', 'user__last_name']
