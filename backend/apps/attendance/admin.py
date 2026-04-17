from django.contrib import admin
from .models import AttendanceSession, AttendanceRecord, TeacherAttendance

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


@admin.register(TeacherAttendance)
class TeacherAttendanceAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'work_date', 'status', 'check_in', 'check_out', 'recorded_by']
    list_filter = ['status', 'work_date']
    search_fields = ['teacher__teacher_code', 'teacher__user__first_name', 'teacher__user__last_name']
    date_hierarchy = 'work_date'
