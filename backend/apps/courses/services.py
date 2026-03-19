from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Course, ClassRoom, Enrollment
from apps.accounts.models import Student


class CourseService:
    @staticmethod
    @transaction.atomic
    def create_course(data):
        """Tạo khóa học mới với mã khóa học viết hoa"""
        code = data.get('code', '').upper()
        if Course.objects.filter(code=code).exists():
            raise ValidationError(f"Khóa học với mã {code} đã tồn tại.")

        course = Course.objects.create(
            name=data.get('name'),
            code=code,
            language=data.get('language', 'english'),
            level=data.get('level', 'beginner'),
            description=data.get('description', ''),
            duration_weeks=data.get('duration_weeks', 12),
            total_hours=data.get('total_hours', 36),
            tuition_fee=data.get('tuition_fee', 0),
            max_students=data.get('max_students', 30)
        )
        return course

    @staticmethod
    @transaction.atomic
    def update_course(course_id, data):
        """Cập nhật thông tin khóa học"""
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            raise ValidationError("Không tìm thấy khóa học.")

        if 'code' in data:
            new_code = data['code'].upper()
            if Course.objects.filter(code=new_code).exclude(id=course_id).exists():
                raise ValidationError(f"Mã khóa học {new_code} đã tồn tại ở khóa học khác.")
            course.code = new_code

        course.name = data.get('name', course.name)
        course.language = data.get('language', course.language)
        course.level = data.get('level', course.level)
        course.description = data.get('description', course.description)
        course.duration_weeks = data.get('duration_weeks', course.duration_weeks)
        course.total_hours = data.get('total_hours', course.total_hours)
        course.tuition_fee = data.get('tuition_fee', course.tuition_fee)
        course.max_students = data.get('max_students', course.max_students)
        course.is_active = data.get('is_active', course.is_active)
        
        course.save()
        return course

    @staticmethod
    @transaction.atomic
    def enroll_student(student_id, classroom_id):
        """Logic nghiệp vụ đăng ký vào lớp: Kiểm tra trùng lặp và giới hạn sĩ số"""
        try:
            student = Student.objects.get(id=student_id)
            classroom = ClassRoom.objects.get(id=classroom_id)
        except (Student.DoesNotExist, ClassRoom.DoesNotExist):
            raise ValidationError("Học viên hoặc Lớp học không hợp lệ.")

        # Kiểm tra trùng lặp
        if Enrollment.objects.filter(student=student, classroom=classroom).exists():
            raise ValidationError("Học viên này đã tham gia lớp học rồi.")

        # Kiểm tra giới hạn số lượng học viên
        if classroom.current_students >= classroom.max_students:
            raise ValidationError("Lớp học đã đạt số lượng tối đa học viên.")

        enrollment = Enrollment.objects.create(
            student=student,
            classroom=classroom,
            status='active'
        )
        return enrollment

    @staticmethod
    def get_active_course_stats():
        """Thống kê khóa học đang hoạt động"""
        return {
            'total_courses': Course.objects.filter(is_active=True).count(),
            'total_enrollments': Enrollment.objects.filter(status='active').count(),
        }
