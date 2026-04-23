"""
Serializers - Attendance API
Nghiệp vụ: Chọn buổi → Điểm danh
- Status: present / absent
- Nếu absent → absence_reason + is_excused
"""
from rest_framework import serializers
from .models import AttendanceSession, AttendanceRecord, TeacherAttendance


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer cho AttendanceRecord"""
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source='student.student_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    session_date = serializers.DateField(source='session.session_date', read_only=True)
    session_number = serializers.IntegerField(source='session.session_number', read_only=True)
    topic = serializers.CharField(source='session.topic', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'session', 'session_date', 'session_number', 'topic',
                  'student', 'student_name', 'student_code',
                  'status', 'status_display',
                  'absence_reason', 'is_excused',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()

    def validate(self, data):
        """Nếu absent → bắt buộc lý do vắng"""
        if data.get('status') == 'absent':
            if not data.get('absence_reason'):
                # Cho phép để trống lý do nhưng mặc định là 'Không rõ'
                data['absence_reason'] = data.get('absence_reason') or 'Không rõ'
        else:
            # Nếu present → xóa lý do vắng
            data['absence_reason'] = None
            data['is_excused'] = False
        return data


class AttendanceSessionSerializer(serializers.ModelSerializer):
    """Serializer cho AttendanceSession - Chi tiết (kèm records)"""
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    classroom_code = serializers.CharField(source='classroom.code', read_only=True)
    records = AttendanceRecordSerializer(many=True, read_only=True)
    total_present = serializers.SerializerMethodField()
    total_absent = serializers.SerializerMethodField()
    total_absent_excused = serializers.SerializerMethodField()
    total_absent_unexcused = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = ['id', 'classroom', 'classroom_name', 'classroom_code',
                  'session_date', 'session_number',
                  'topic', 'notes', 'records',
                  'total_present', 'total_absent',
                  'total_absent_excused', 'total_absent_unexcused',
                  'total_students', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_total_present(self, obj):
        return obj.records.filter(status='present').count()

    def get_total_absent(self, obj):
        return obj.records.filter(status='absent').count()

    def get_total_absent_excused(self, obj):
        return obj.records.filter(status='absent', is_excused=True).count()

    def get_total_absent_unexcused(self, obj):
        return obj.records.filter(status='absent', is_excused=False).count()

    def get_total_students(self, obj):
        return obj.records.count()


class AttendanceSessionListSerializer(serializers.ModelSerializer):
    """Serializer danh sách buổi học (không kèm records) - hiệu suất cao"""
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    classroom_code = serializers.CharField(source='classroom.code', read_only=True)
    total_present = serializers.SerializerMethodField()
    total_absent = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()
    has_attendance = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = ['id', 'classroom', 'classroom_name', 'classroom_code',
                  'session_date', 'session_number', 'topic',
                  'total_present', 'total_absent', 'total_students',
                  'has_attendance', 'created_at']

    def get_total_present(self, obj):
        return obj.records.filter(status='present').count()

    def get_total_absent(self, obj):
        return obj.records.filter(status='absent').count()

    def get_total_students(self, obj):
        return obj.records.count()

    def get_has_attendance(self, obj):
        """Buổi này đã điểm danh chưa"""
        return obj.records.exists()


class BulkAttendanceSerializer(serializers.Serializer):
    """Serializer điểm danh hàng loạt cho cả lớp
    
    Mỗi record gồm:
    - student_id: ID học viên
    - status: 'present' hoặc 'absent'
    - absence_reason: Lý do vắng (bắt buộc khi absent)
    - is_excused: Có phép (true/false)
    """
    classroom_id = serializers.IntegerField()
    session_date = serializers.DateField()
    session_number = serializers.IntegerField(default=1)
    topic = serializers.CharField(required=False, allow_blank=True)
    records = serializers.ListField(
        child=serializers.DictField()
    )


class TeacherAttendanceSerializer(serializers.ModelSerializer):
    """Chấm công giảng viên (theo ngày)."""
    teacher_name = serializers.SerializerMethodField()
    teacher_code = serializers.CharField(source='teacher.teacher_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TeacherAttendance
        fields = [
            'id',
            'teacher',
            'teacher_name',
            'teacher_code',
            'work_date',
            'check_in',
            'check_out',
            'status',
            'status_display',
            'absence_reason',
            'notes',
            'recorded_by',
            'recorded_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'teacher_name',
            'teacher_code',
            'status_display',
            'recorded_by_name',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'teacher': {'required': False},
            'recorded_by': {'required': False, 'allow_null': True},
        }

    def get_teacher_name(self, obj):
        return obj.teacher.user.get_full_name()

    def get_recorded_by_name(self, obj):
        if obj.recorded_by_id:
            return obj.recorded_by.get_full_name() or obj.recorded_by.username
        return None

    def validate(self, data):
        request = self.context.get('request')
        role = getattr(request.user, 'role', None) if request else None
        if role in ('admin', 'staff') and self.instance is None and not data.get('teacher'):
            raise serializers.ValidationError({'teacher': 'Bắt buộc chọn giảng viên'})
        status_val = data.get('status', getattr(self.instance, 'status', None) if self.instance else 'present')
        if status_val in ('absent', 'leave', 'leave_unpaid'):
            if not data.get('absence_reason') and not (self.instance and self.instance.absence_reason):
                data['absence_reason'] = data.get('absence_reason') or 'Không rõ'
        return data

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == 'teacher':
            validated_data.pop('teacher', None)
            validated_data.pop('recorded_by', None)
        return super().update(instance, validated_data)
