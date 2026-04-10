"""
Serializers - Attendance API
"""
from rest_framework import serializers
from .models import AttendanceSession, AttendanceRecord


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer cho AttendanceRecord"""
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source='student.student_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    session_date = serializers.DateField(source='session.session_date', read_only=True)
    topic = serializers.CharField(source='session.topic', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'session', 'session_date', 'topic', 'student', 'student_name', 'student_code',
                  'status', 'status_display', 'notes']
        read_only_fields = ['id']

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()


class AttendanceSessionSerializer(serializers.ModelSerializer):
    """Serializer cho AttendanceSession"""
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    records = AttendanceRecordSerializer(many=True, read_only=True)
    total_present = serializers.SerializerMethodField()
    total_absent = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = ['id', 'classroom', 'classroom_name', 'session_date', 'session_number',
                  'topic', 'notes', 'records', 'total_present', 'total_absent',
                  'total_students', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_total_present(self, obj):
        return obj.records.filter(status='present').count()

    def get_total_absent(self, obj):
        return obj.records.filter(status='absent').count()

    def get_total_students(self, obj):
        return obj.records.count()


class AttendanceSessionListSerializer(serializers.ModelSerializer):
    """Serializer danh sách (không kèm records)"""
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    total_present = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = ['id', 'classroom', 'classroom_name', 'session_date',
                  'session_number', 'topic', 'total_present', 'total_students', 'created_at']

    def get_total_present(self, obj):
        return obj.records.filter(status='present').count()

    def get_total_students(self, obj):
        return obj.records.count()


class BulkAttendanceSerializer(serializers.Serializer):
    """Serializer điểm danh hàng loạt"""
    classroom_id = serializers.IntegerField()
    session_date = serializers.DateField()
    session_number = serializers.IntegerField(default=1)
    topic = serializers.CharField(required=False, allow_blank=True)
    records = serializers.ListField(
        child=serializers.DictField()
    )
