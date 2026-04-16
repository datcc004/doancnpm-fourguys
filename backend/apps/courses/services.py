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
            total_lessons=data.get('total_lessons', 24),
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
        course.total_lessons = data.get('total_lessons', course.total_lessons)
        course.tuition_fee = data.get('tuition_fee', course.tuition_fee)
        course.max_students = data.get('max_students', course.max_students)
        course.is_active = data.get('is_active', course.is_active)
        
        course.save()
        return course

    @staticmethod
    def _check_schedule_conflict(class1, class2):
        """
        Kiểm tra xem hai lớp học có bị trùng lịch không.
        Returns True nếu trùng, False nếu không.
        """
        # 1. Kiểm tra giao ngày (Date range)
        if class1.start_date > class2.end_date or class2.start_date > class1.end_date:
            return False
            
        # 2. Kiểm tra giao thứ (Days of week)
        s1 = (class1.schedule or "").upper()
        s2 = (class2.schedule or "").upper()
        
        days_mapping = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
        common_days = [d for d in days_mapping if d in s1 and d in s2]
        
        if not common_days:
            return False
            
        # 3. Kiểm tra giao giờ (Time range)
        import re
        time_pattern = r'(\d{1,2}:\d{2})-(\d{1,2}:\d{2})'
        t1 = re.search(time_pattern, s1)
        t2 = re.search(time_pattern, s2)
        
        if t1 and t2:
            start1, end1 = t1.groups()
            start2, end2 = t2.groups()
            
            def to_min(t_str):
                try:
                    h, m = map(int, t_str.split(':'))
                    return h * 60 + m
                except: return 0
                
            s1_min, e1_min = to_min(start1), to_min(end1)
            s2_min, e2_min = to_min(start2), to_min(end2)
            
            # Giao nhau nếu (Start1 < End2) AND (Start2 < End1)
            if s1_min < e2_min and s2_min < e1_min:
                return True
                
        return False

    @staticmethod
    @transaction.atomic
    def enroll_student(student_id, classroom_id, deposit_amount=0, created_by_user=None):
        """
        Đăng ký học viên vào lớp học:
        - Kiểm tra trùng lịch
        - Kiểm tra sĩ số
        - Tạo bản ghi Enrollment & Payment
        """
        from apps.payments.models import Payment
        from datetime import date, timedelta

        try:
            student = Student.objects.select_related('user').get(id=student_id)
            classroom = ClassRoom.objects.select_related('course').get(id=classroom_id)
        except (Student.DoesNotExist, ClassRoom.DoesNotExist):
            raise ValidationError("Học viên hoặc Lớp học không hợp lệ.")

        if classroom.status != 'upcoming':
            raise ValidationError(f"Chỉ có thể đăng ký lớp 'Sắp khai giảng'. Lớp này đang: {classroom.get_status_display()}")

        if Enrollment.objects.filter(student=student, classroom=classroom).exists():
            raise ValidationError("Học viên đã ở trong lớp này rồi.")

        # Kiểm tra trùng lịch
        active_enrollments = Enrollment.objects.filter(
            student=student,
            status='active',
            classroom__status__in=['active', 'upcoming']
        ).select_related('classroom')

        for en in active_enrollments:
            if CourseService._check_schedule_conflict(classroom, en.classroom):
                raise ValidationError(
                    f"Trùng lịch! Học viên đã có lịch học '{en.classroom.schedule}' tại lớp {en.classroom.code}."
                )

        # Kiểm tra cọc tổi thiểu 30%
        from decimal import Decimal
        required_deposit = classroom.course.tuition_fee * Decimal('0.3')
        deposit_decimal = Decimal(str(deposit_amount) if deposit_amount else '0')
        
        if deposit_decimal < required_deposit:
            raise ValidationError(f"Phải cọc trước tối thiểu 30% học phí (tương đương {(required_deposit):,.0f} VNĐ) mới có thể đăng ký.")
            
        payment_status = 'unpaid'
        if deposit_decimal >= classroom.course.tuition_fee:
            payment_status = 'paid'
        elif deposit_decimal >= required_deposit:
            payment_status = 'deposited'

        enrollment = Enrollment.objects.create(
            student=student,
            classroom=classroom,
            status='active',
            deposit_amount=deposit_decimal,
            payment_status=payment_status,
            notes=f"Đăng ký vào ngày {date.today()}"
        )

        due_date = min(date.today() + timedelta(days=7), classroom.start_date - timedelta(days=1))
        
        payment = Payment.objects.create(
            student=student,
            enrollment=enrollment,
            amount=classroom.course.tuition_fee,
            discount=0,
            final_amount=classroom.course.tuition_fee - deposit_decimal,
            payment_method='cash',
            status='paid' if payment_status == 'paid' else 'pending',
            due_date=due_date,
            created_by=created_by_user,
            notes=f"Học phí lớp {classroom.code}"
        )

        # ---- Tự động gửi Email xác nhận ----
        try:
            from apps.accounts.utils import send_enrollment_email
            if student.user.email:
                send_enrollment_email(student, classroom, payment)
        except Exception as email_err:
            print(f"Lỗi gửi email: {str(email_err)}")

        return enrollment, payment

    @staticmethod
    @transaction.atomic
    def complete_classroom(classroom_id):
        """Kết thúc lớp học"""
        try:
            classroom = ClassRoom.objects.get(id=classroom_id)
        except ClassRoom.DoesNotExist:
            raise ValidationError("Lớp học không tồn tại.")

        if classroom.status != 'active':
            raise ValidationError("Chỉ có thể kết thúc lớp đang học.")

        classroom.status = 'completed'
        classroom.save()

        Enrollment.objects.filter(classroom=classroom, status='active').update(status='completed')
        return classroom

    @staticmethod
    def auto_complete_expired_classes():
        from datetime import date
        expired_classes = ClassRoom.objects.filter(status='active', end_date__lt=date.today())
        for c in expired_classes:
            try:
                CourseService.complete_classroom(c.id)
            except Exception:
                pass

    @staticmethod
    def get_active_course_stats():
        return {
            'total_courses': Course.objects.filter(is_active=True).count(),
            'total_enrollments': Enrollment.objects.filter(status='active').count(),
        }
