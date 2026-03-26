from django.test import TestCase
from django.core.exceptions import ValidationError
from datetime import date, timedelta
from apps.accounts.models import User, Student
from .models import Course, ClassRoom, Enrollment
from .services import CourseService


class CourseServiceLayerTest(TestCase):
    def setUp(self):
        # Tạo dữ liệu mẫu
        self.course_data = {
            'name': 'Tiếng Nhật N3',
            'code': 'JPN301',
            'language': 'japanese',
            'level': 'intermediate',
            'tuition_fee': 5000000,
            'max_students': 25
        }
        
        self.course = CourseService.create_course(self.course_data)
        
        self.user = User.objects.create_user(username="test_std", password="password123")
        self.student = Student.objects.create(user=self.user, student_code="S001")
        
        self.classroom = ClassRoom.objects.create(
            name="Lớp N3-A1",
            code="N3A1",
            course=self.course,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=90),
            max_students=2 # Giới hạn nhỏ để test full
        )

    def test_1_create_course_success(self):
        """Test tạo khóa học thành công qua Service"""
        new_data = self.course_data.copy()
        new_data['code'] = 'JPN302'
        course = CourseService.create_course(new_data)
        self.assertEqual(course.code, 'JPN302')
        self.assertEqual(Course.objects.filter(code='JPN302').count(), 1)

    def test_2_create_course_duplicate_fail(self):
        """Test tạo khóa học trùng mã qua Service phải báo lỗi"""
        with self.assertRaises(ValidationError):
            CourseService.create_course(self.course_data)

    def test_3_enroll_student_success(self):
        """Test đăng ký học viên thành công qua Service"""
        enrollment = CourseService.enroll_student(self.student.id, self.classroom.id)
        self.assertEqual(enrollment.student, self.student)
        self.assertEqual(enrollment.classroom, self.classroom)
        self.assertEqual(self.classroom.current_students, 1)

    def test_4_enroll_student_full_fail(self):
        """Test đăng ký vào lớp đã đầy phải báo lỗi"""
        # Đăng ký 2 người đầu tiên (Sĩ số tối đa là 2)
        CourseService.enroll_student(self.student.id, self.classroom.id)
        
        user2 = User.objects.create_user(username="test_std2", password="password123")
        student2 = Student.objects.create(user=user2, student_code="S002")
        CourseService.enroll_student(student2.id, self.classroom.id)
        
        # Người thứ 3
        user3 = User.objects.create_user(username="test_std3", password="password123")
        student3 = Student.objects.create(user=user3, student_code="S003")
        
        with self.assertRaises(ValidationError):
            CourseService.enroll_student(student3.id, self.classroom.id)

    def test_5_get_stats_correctly(self):
        """Test thống kê khóa học qua Service"""
        # Hiện có 1 khóa học và 0 enrollment
        stats = CourseService.get_active_course_stats()
        self.assertEqual(stats['total_courses'], 1)
        self.assertEqual(stats['total_enrollments'], 0)
        
        # Thêm 1 enrollment
        CourseService.enroll_student(self.student.id, self.classroom.id)
        stats = CourseService.get_active_course_stats()
        self.assertEqual(stats['total_enrollments'], 1)
