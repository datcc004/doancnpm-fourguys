"""
Management command - Tạo dữ liệu mẫu
"""
import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models import User, Student, Teacher
from apps.courses.models import Course, ClassRoom, Enrollment
from apps.payments.models import Payment
import datetime


class Command(BaseCommand):
    help = 'Tạo dữ liệu mẫu cho hệ thống'

    def handle(self, *args, **options):
        self.stdout.write('Đang tạo dữ liệu mẫu...')

        # Tạo Admin
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@langcenter.vn',
                'first_name': 'Admin',
                'last_name': 'Hệ thống',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save()
            self.stdout.write(self.style.SUCCESS('✓ Tạo admin: admin / admin123'))

        # Tạo Staff
        staff, created = User.objects.get_or_create(
            username='staff01',
            defaults={
                'email': 'staff01@langcenter.vn',
                'first_name': 'Nhân viên',
                'last_name': 'Nguyễn Văn',
                'role': 'staff',
                'phone': '0901234567',
            }
        )
        if created:
            staff.set_password('staff123')
            staff.save()
            self.stdout.write(self.style.SUCCESS('✓ Tạo nhân viên: staff01 / staff123'))

        # Tạo Teachers
        teacher_data = [
            {'code': 'GV001', 'first': 'An', 'last': 'Trần Thị', 'spec': 'IELTS', 'qual': 'MA TESOL', 'exp': 5, 'rate': 300000},
            {'code': 'GV002', 'first': 'Bình', 'last': 'Lê Văn', 'spec': 'TOEIC', 'qual': 'BA English', 'exp': 3, 'rate': 250000},
            {'code': 'GV003', 'first': 'Hana', 'last': 'Tanaka', 'spec': 'Tiếng Nhật', 'qual': 'JLPT N1', 'exp': 7, 'rate': 350000},
            {'code': 'GV004', 'first': 'Minh', 'last': 'Phạm Hoàng', 'spec': 'Tiếng Trung', 'qual': 'HSK 6', 'exp': 4, 'rate': 280000},
            {'code': 'GV005', 'first': 'Linh', 'last': 'Nguyễn Thùy', 'spec': 'Giao tiếp', 'qual': 'CELTA', 'exp': 6, 'rate': 320000},
        ]

        teachers = []
        for td in teacher_data:
            user, created = User.objects.get_or_create(
                username=td['code'].lower(),
                defaults={
                    'email': f"{td['code'].lower()}@langcenter.vn",
                    'first_name': td['first'],
                    'last_name': td['last'],
                    'role': 'teacher',
                    'phone': f'09{random.randint(10000000, 99999999)}',
                }
            )
            if created:
                user.set_password('teacher123')
                user.save()

            teacher, _ = Teacher.objects.get_or_create(
                teacher_code=td['code'],
                defaults={
                    'user': user,
                    'specialization': td['spec'],
                    'qualification': td['qual'],
                    'experience_years': td['exp'],
                    'hourly_rate': td['rate'],
                }
            )
            teachers.append(teacher)
        self.stdout.write(self.style.SUCCESS(f'✓ Tạo {len(teachers)} giảng viên'))

        # Tạo Students
        student_names = [
            ('Huy', 'Nguyễn Đức'), ('Lan', 'Trần Thị'), ('Tuấn', 'Lê Minh'),
            ('Mai', 'Phạm Thị'), ('Đức', 'Hoàng Văn'), ('Linh', 'Vũ Thị'),
            ('Nam', 'Đặng Hoàng'), ('Hoa', 'Bùi Thị'), ('Khánh', 'Ngô Đình'),
            ('Trang', 'Lý Thị'), ('Phong', 'Trịnh Văn'), ('Ngọc', 'Cao Thị'),
            ('Dũng', 'Đinh Văn'), ('Yến', 'Hà Thị'), ('Long', 'Phan Thành'),
        ]

        students = []
        for i, (first, last) in enumerate(student_names, 1):
            code = f'HV{i:03d}'
            user, created = User.objects.get_or_create(
                username=code.lower(),
                defaults={
                    'email': f"{code.lower()}@gmail.com",
                    'first_name': first,
                    'last_name': last,
                    'role': 'student',
                    'phone': f'09{random.randint(10000000, 99999999)}',
                }
            )
            if created:
                user.set_password('student123')
                user.save()

            student, _ = Student.objects.get_or_create(
                student_code=code,
                defaults={
                    'user': user,
                    'level': random.choice(['Sơ cấp', 'Cơ bản', 'Trung cấp', 'Cao cấp']),
                }
            )
            students.append(student)
        self.stdout.write(self.style.SUCCESS(f'✓ Tạo {len(students)} học viên'))

        # Tạo Courses
        courses_data = [
            {'code': 'ENG-IELTS-01', 'name': 'IELTS Foundation', 'lang': 'english', 'level': 'intermediate', 'weeks': 16, 'hours': 48, 'fee': 8500000},
            {'code': 'ENG-TOEIC-01', 'name': 'TOEIC 600+', 'lang': 'english', 'level': 'elementary', 'weeks': 12, 'hours': 36, 'fee': 5500000},
            {'code': 'ENG-COM-01', 'name': 'English Communication', 'lang': 'english', 'level': 'beginner', 'weeks': 10, 'hours': 30, 'fee': 4000000},
            {'code': 'JPN-N4-01', 'name': 'Tiếng Nhật N4', 'lang': 'japanese', 'level': 'elementary', 'weeks': 14, 'hours': 42, 'fee': 6000000},
            {'code': 'JPN-N3-01', 'name': 'Tiếng Nhật N3', 'lang': 'japanese', 'level': 'intermediate', 'weeks': 16, 'hours': 48, 'fee': 7500000},
            {'code': 'CHN-HSK3-01', 'name': 'Tiếng Trung HSK 3', 'lang': 'chinese', 'level': 'elementary', 'weeks': 12, 'hours': 36, 'fee': 5000000},
            {'code': 'KOR-TOPIK1-01', 'name': 'Tiếng Hàn TOPIK I', 'lang': 'korean', 'level': 'beginner', 'weeks': 12, 'hours': 36, 'fee': 4500000},
        ]

        courses = []
        for cd in courses_data:
            course, _ = Course.objects.get_or_create(
                code=cd['code'],
                defaults={
                    'name': cd['name'],
                    'language': cd['lang'],
                    'level': cd['level'],
                    'duration_weeks': cd['weeks'],
                    'total_hours': cd['hours'],
                    'tuition_fee': cd['fee'],
                    'description': f"Khóa học {cd['name']} tại trung tâm ngoại ngữ",
                }
            )
            courses.append(course)
        self.stdout.write(self.style.SUCCESS(f'✓ Tạo {len(courses)} khóa học'))

        # Tạo Classes
        classes_data = [
            {'code': 'IELTS-A1', 'name': 'IELTS Sáng T2-T4-T6', 'course': 0, 'teacher': 0, 'schedule': 'T2-T4-T6 8:00-10:00', 'room': 'P.201'},
            {'code': 'IELTS-B1', 'name': 'IELTS Tối T3-T5-T7', 'course': 0, 'teacher': 0, 'schedule': 'T3-T5-T7 18:00-20:00', 'room': 'P.302'},
            {'code': 'TOEIC-A1', 'name': 'TOEIC Chiều T2-T4', 'course': 1, 'teacher': 1, 'schedule': 'T2-T4 14:00-16:30', 'room': 'P.101'},
            {'code': 'COMM-A1', 'name': 'Giao tiếp Sáng T3-T5', 'course': 2, 'teacher': 4, 'schedule': 'T3-T5 9:00-11:00', 'room': 'P.105'},
            {'code': 'JPN-N4-A1', 'name': 'Nhật N4 Tối T2-T4-T6', 'course': 3, 'teacher': 2, 'schedule': 'T2-T4-T6 18:30-20:30', 'room': 'P.203'},
            {'code': 'CHN-A1', 'name': 'Trung HSK3 Sáng T7-CN', 'course': 5, 'teacher': 3, 'schedule': 'T7-CN 8:00-11:00', 'room': 'P.301'},
        ]

        classrooms = []
        for cd in classes_data:
            now = timezone.now().date()
            classroom, _ = ClassRoom.objects.get_or_create(
                code=cd['code'],
                defaults={
                    'name': cd['name'],
                    'course': courses[cd['course']],
                    'teacher': teachers[cd['teacher']],
                    'schedule': cd['schedule'],
                    'room': cd['room'],
                    'start_date': now - datetime.timedelta(days=random.randint(10, 60)),
                    'end_date': now + datetime.timedelta(days=random.randint(30, 120)),
                    'status': 'active',
                    'max_students': 25,
                }
            )
            classrooms.append(classroom)
        self.stdout.write(self.style.SUCCESS(f'✓ Tạo {len(classrooms)} lớp học'))

        # Tạo Enrollments
        enrollment_count = 0
        for classroom in classrooms:
            selected = random.sample(students, random.randint(5, min(10, len(students))))
            for student in selected:
                _, created = Enrollment.objects.get_or_create(
                    student=student,
                    classroom=classroom,
                    defaults={'status': 'active'}
                )
                if created:
                    enrollment_count += 1
        self.stdout.write(self.style.SUCCESS(f'✓ Tạo {enrollment_count} đăng ký'))

        # Tạo Payments
        payment_count = 0
        for enrollment in Enrollment.objects.select_related('classroom__course', 'student'):
            fee = enrollment.classroom.course.tuition_fee
            _, created = Payment.objects.get_or_create(
                student=enrollment.student,
                enrollment=enrollment,
                defaults={
                    'amount': fee,
                    'discount': random.choice([0, 0, 0, 500000, 1000000]),
                    'final_amount': fee - random.choice([0, 0, 0, 500000, 1000000]),
                    'payment_method': random.choice(['cash', 'transfer', 'card']),
                    'status': random.choice(['paid', 'paid', 'paid', 'pending']),
                    'payment_date': timezone.now() - datetime.timedelta(days=random.randint(1, 30)),
                    'created_by': admin,
                }
            )
            if created:
                payment_count += 1
        self.stdout.write(self.style.SUCCESS(f'✓ Tạo {payment_count} thanh toán'))

        self.stdout.write(self.style.SUCCESS('\n=== Hoàn tất tạo dữ liệu mẫu! ==='))
        self.stdout.write('Tài khoản đăng nhập:')
        self.stdout.write('  Admin:    admin / admin123')
        self.stdout.write('  Staff:    staff01 / staff123')
        self.stdout.write('  Teacher:  gv001 / teacher123')
        self.stdout.write('  Student:  hv001 / student123')
