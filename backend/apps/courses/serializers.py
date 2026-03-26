"""
Serializers - Chuyển đổi dữ liệu cho API courses
"""
from rest_framework import serializers
from .models import Course, ClassRoom, Enrollment
from apps.accounts.serializers import StudentSerializer, TeacherSerializer


class CourseSerializer(serializers.ModelSerializer):
    """Serializer cho Course"""
    total_classes = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ['id', 'name', 'code', 'language', 'level', 'description',
                  'duration_weeks', 'total_hours', 'tuition_fee', 'max_students',
                  'is_active', 'total_classes', 'total_students', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_code(self, value):
        """Kiểm tra mã khóa học: hoa, không trùng, regex [A-Z]{2,5}[0-9]{2,4}"""
        import re
        value = value.upper()
        if not re.match(r'^[A-Z]{2,5}[0-9]{2,4}$', value):
            raise serializers.ValidationError("Mã khóa học không hợp lệ (Ví dụ: ENG101, JP202).")
        
        if Course.objects.filter(code=value).exists():
            if not self.instance or self.instance.code != value:
                raise serializers.ValidationError("Mã khóa học này đã tồn tại.")
        return value

    def validate_tuition_fee(self, value):
        """Học phí không được âm và phải lớn hơn 0"""
        if value < 0:
            raise serializers.ValidationError("Học phí không thể là số âm.")
        if value == 0:
            raise serializers.ValidationError("Học phí phải lớn hơn 0.")
        return value

    def validate_duration_weeks(self, value):
        """Thời lượng từ 1 đến 52 tuần"""
        if value < 1 or value > 52:
            raise serializers.ValidationError("Thời lượng khóa học phải từ 1 đến 52 tuần.")
        return value

    def validate_max_students(self, value):
        """Số lượng học viên từ 1 đến 100"""
        if value < 1 or value > 100:
            raise serializers.ValidationError("Sĩ số tối đa từ 1 đến 100 học viên.")
        return value

    def get_total_classes(self, obj):
        return obj.classrooms.count()

    def get_total_students(self, obj):
        return Enrollment.objects.filter(classroom__course=obj, status='active').count()


class ClassRoomSerializer(serializers.ModelSerializer):
    """Serializer cho ClassRoom"""
    course_name = serializers.CharField(source='course.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    current_students = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()

    class Meta:
        model = ClassRoom
        fields = ['id', 'name', 'code', 'course', 'course_name', 'teacher', 'teacher_name',
                  'room', 'schedule', 'learning_mode', 'start_date', 'end_date', 'start_time', 'end_time',
                  'status', 'max_students', 'current_students', 'is_full', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, data):
        """Kiểm tra logic ngày bắt đầu/kết thúc"""
        if data.get('start_date') and data.get('end_date'):
            if data['start_date'] > data['end_date']:
                raise serializers.ValidationError("Ngày bắt đầu không thể sau ngày kết thúc.")
        return data

    def validate_code(self, value):
        """Mã lớp phải là duy nhất"""
        value = value.upper()
        if ClassRoom.objects.filter(code=value).exists():
            if not self.instance or self.instance.code != value:
                raise serializers.ValidationError("Mã lớp học này đã tồn tại.")
        return value

    def get_teacher_name(self, obj):
        if obj.teacher:
            return obj.teacher.user.get_full_name()
        return None


class ClassRoomDetailSerializer(ClassRoomSerializer):
    """Serializer chi tiết ClassRoom (kèm danh sách học viên)"""
    course = CourseSerializer(read_only=True)
    teacher = TeacherSerializer(read_only=True)
    students = serializers.SerializerMethodField()

    class Meta:
        model = ClassRoom
        fields = ClassRoomSerializer.Meta.fields + ['students']

    def get_students(self, obj):
        enrollments = obj.enrollments.filter(status='active').select_related('student__user')
        return [
            {
                'enrollment_id': e.id,
                'student': StudentSerializer(e.student).data,
                'enrollment_date': e.enrollment_date,
                'status': e.status,
                'final_grade': e.final_grade,
            }
            for e in enrollments
        ]


class EnrollmentSerializer(serializers.ModelSerializer):
    """Serializer cho Enrollment"""
    student_name = serializers.SerializerMethodField()
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    course_name = serializers.CharField(source='classroom.course.name', read_only=True)

    class Meta:
        model = Enrollment
        fields = ['id', 'student', 'student_name', 'classroom', 'classroom_name',
                  'course_name', 'enrollment_date', 'status', 'final_grade', 'notes']
        read_only_fields = ['id', 'enrollment_date']

    def validate(self, data):
        """Ngăn chặn đăng ký trùng hoặc lớp đầy"""
        student = data.get('student')
        classroom = data.get('classroom')
        
        if not self.instance: # Chỉ kiểm tra khi tạo mới
            if Enrollment.objects.filter(student=student, classroom=classroom).exists():
                raise serializers.ValidationError("Học viên này đã đăng ký lớp học này rồi.")
            
            if classroom.current_students >= classroom.max_students:
                raise serializers.ValidationError("Lớp học này đã đủ số lượng học viên.")
        
        return data

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()
