from django.contrib import admin
from .models import AttendanceSession, AttendanceRecord

@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ['classroom', 'session_date', 'session_number', 'topic']
    list_filter = ['classroom', 'session_date']

@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ['session', 'student', 'status']
    list_filter = ['status']
