from django.contrib import admin
from .models import AttendanceSession, AttendanceRecord

@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ['classroom', 'session_date', 'session_number', 'topic', 'created_by']
    list_filter = ['classroom', 'session_date']
    search_fields = ['classroom__name', 'classroom__code', 'topic']

@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ['session', 'student', 'status', 'absence_reason', 'is_excused']
    list_filter = ['status', 'is_excused']
    search_fields = ['student__user__first_name', 'student__user__last_name', 'student__student_code']
