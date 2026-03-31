"""
Views - API endpoints cho courses
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q

from .models import Course, ClassRoom, Enrollment
from .serializers import (
    CourseSerializer, ClassRoomSerializer, ClassRoomDetailSerializer,
    EnrollmentSerializer
)
from apps.accounts.permissions import IsStaffOrAdmin


class CourseViewSet(viewsets.ModelViewSet):
    """CRUD cho Course"""
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code', 'description']
    filterset_fields = ['language', 'level', 'is_active']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'cancel_enrollment']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsStaffOrAdmin()]

    @action(detail=True, methods=['post'])
    def cancel_enrollment(self, request, pk=None):
        """Hủy đăng ký khóa học (chỉ dành cho học viên chưa được xếp lớp)"""
        course = self.get_object()
        if request.user.role != 'student' or not hasattr(request.user, 'student_profile'):
            return Response({'error': 'Chỉ học viên mới có thể hủy đăng ký.'}, status=status.HTTP_403_FORBIDDEN)
            
        student = request.user.student_profile
        from django.db.models import Q
        enrollments = Enrollment.objects.filter(student=student).filter(
            Q(course=course) | Q(classroom__course=course)
        )
        
        if not enrollments.exists():
            return Response({'error': 'Bạn chưa đăng ký khóa học này.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Không cho hủy nếu đã được xếp lớp
        for e in enrollments:
            if e.classroom is not None:
                return Response({'error': 'Không thể hủy vì bạn đã được xếp lớp. Vui lòng liên hệ trung tâm.'}, status=status.HTTP_400_BAD_REQUEST)
        
        enrollments.delete()
        return Response({'message': 'Đã hủy đăng ký khóa học thành công.'}, status=status.HTTP_200_OK)


class ClassRoomViewSet(viewsets.ModelViewSet):
    """CRUD cho ClassRoom"""
    queryset = ClassRoom.objects.select_related('course', 'teacher__user').all()
    serializer_class = ClassRoomSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code', 'course__name']
    filterset_fields = ['status', 'course', 'teacher']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'enroll', 'my_classes', 'students']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsStaffOrAdmin()]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClassRoomDetailSerializer
        return ClassRoomSerializer

    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        """Đăng ký học viên vào lớp thông qua CourseService"""
        from .services import CourseService
        from .serializers import EnrollmentSerializer
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError as DRFValidationError
        
        classroom = self.get_object()
        
        # Nếu là học viên tự đăng ký thì lấy ID của chính họ
        if request.user.role == 'student':
            if hasattr(request.user, 'student_profile'):
                student_id = request.user.student_profile.id
            else:
                return Response({'error': 'Tài khoản chưa có hồ sơ học viên'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            student_id = request.data.get('student_id')

        if not student_id:
            return Response({'error': 'Vui lòng cung cấp student_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Gọi Service để xử lý logic nghiệp vụ
            enrollment, payment = CourseService.enroll_student(
                student_id=student_id, 
                classroom_id=classroom.id,
                created_by_user=request.user
            )
            
            data = EnrollmentSerializer(enrollment).data
            data['payment_id'] = payment.id
            data['message'] = f"Đăng ký thành công. Một yêu cầu thanh toán đã được tạo với mã #{payment.id}."
            
            return Response(data, status=status.HTTP_201_CREATED)
            
        except DjangoValidationError as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def my_classes(self, request):
        """Danh sách các lớp học của người dùng hiện tại (Học viên hoặc Admin)"""
        user = request.user
        
        # Nếu là Admin/Staff -> Trả về tất cả các lớp đang mở (để xem lịch tổng quát)
        if user.role in ['admin', 'staff']:
            classrooms = ClassRoom.objects.filter(status__in=['active', 'upcoming']).select_related('course', 'teacher__user')
            return Response(ClassRoomSerializer(classrooms, many=True).data)
            
        # Nếu là Giảng viên -> Trả về các lớp đang dạy
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            teacher = user.teacher_profile
            classrooms = ClassRoom.objects.filter(teacher=teacher, status__in=['active', 'upcoming']).select_related('course', 'teacher__user')
            return Response(ClassRoomSerializer(classrooms, many=True).data)
            
        # Nếu là Học viên -> Trả về lớp đã đăng ký
        if user.role == 'student' and hasattr(user, 'student_profile'):
            student = user.student_profile
            enrollments = Enrollment.objects.filter(student=student, status='active').select_related('classroom__course', 'classroom__teacher__user')
            classrows_list = [e.classroom for e in enrollments]
            return Response(ClassRoomSerializer(classrows_list, many=True).data)
            
        return Response([])

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """Danh sách học viên trong lớp"""
        classroom = self.get_object()
        enrollments = classroom.enrollments.select_related('student__user').all()
        return Response(EnrollmentSerializer(enrollments, many=True).data)
    @action(detail=True, methods=['get'])
    def scheduled_dates(self, request, pk=None):
        """Tính toán danh sách các ngày học thực tế dựa trên lịch biểu (T2-T4-T6, v.v.)"""
        from datetime import timedelta
        classroom = self.get_object()
        start = classroom.start_date
        end = classroom.end_date
        
        if not start or not end:
            return Response([])

        schedule_str = (classroom.schedule or "").upper()
        
        # Ánh xạ các thứ trong tuần (Python weekday: 0=Mon, 6=Sun)
        mapping = {
            'T2': 0, 'THỨ 2': 0, 'THỨ HAI': 0,
            'T3': 1, 'THỨ 3': 1, 'THỨ BA': 1,
            'T4': 2, 'THỨ 4': 2, 'THỨ TƯ': 2,
            'T5': 3, 'THỨ 5': 3, 'THỨ NĂM': 3,
            'T6': 4, 'THỨ 6': 4, 'THỨ SÁU': 4,
            'T7': 5, 'THỨ 7': 5, 'THỨ BẢY': 5,
            'CN': 6, 'CHỦ NHẬT': 6,
        }
        
        active_days = []
        import re
        for key, day_idx in mapping.items():
            if re.search(rf'\b{re.escape(key)}\b', schedule_str):
                active_days.append(day_idx)
            elif key in schedule_str and (key.startswith('THỨ') or key == 'CHỦ NHẬT'):
                active_days.append(day_idx)

        # Nếu vẫn không tìm thấy, thử tìm số đơn lẻ làm fallback (riskier)
        if not active_days:
            for i in range(2, 8):
                if f'T{i}' in schedule_str or f'{i}' in schedule_str:
                    active_days.append(i-2)
            if 'CN' in schedule_str or '8' in schedule_str: active_days.append(6)

        active_days = list(set(active_days))
        if not active_days:
            return Response([])
            
        dates = []
        current = start
        while current <= end:
            if current.weekday() in active_days:
                dates.append(current.strftime('%Y-%m-%d'))
            current += timedelta(days=1)
            
        return Response(dates)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Kết thúc lớp học thông qua CourseService (Staff/Admin only)"""
        from .services import CourseService
        from .serializers import ClassRoomSerializer
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        try:
            classroom = CourseService.complete_classroom(classroom_id=pk)
            return Response(ClassRoomSerializer(classroom).data)
        except DjangoValidationError as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class EnrollmentViewSet(viewsets.ModelViewSet):
    """CRUD cho Enrollment"""
    serializer_class = EnrollmentSerializer
    filterset_fields = ['status', 'classroom', 'student']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'create']:
            return [IsAuthenticated()]
        # Cho phép Giảng viên cập nhật điểm
        if self.action in ['update', 'partial_update']:
            from apps.accounts.permissions import IsStaffOrAdmin, IsTeacher
            return [IsAuthenticated(), (IsStaffOrAdmin | IsTeacher)()]
        return [IsAuthenticated(), IsStaffOrAdmin()]

    def perform_create(self, serializer):
        """Gửi email xác nhận khi học viên đăng ký khóa học"""
        instance = serializer.save()
        try:
            from apps.accounts.utils import send_automated_email
            student = instance.student
            course = instance.course
            if student and student.user.email and course:
                subject = f"[FourGuys] Xác nhận đăng ký khóa học {course.code}"
                message = (
                    f"Chào {student.user.first_name},\n\n"
                    f"Bạn đã đăng ký thành công khóa học: {course.name} ({course.code}).\n"
                    f"Ngôn ngữ: {course.get_language_display()}\n"
                    f"Trình độ: {course.get_level_display()}\n"
                    f"Học phí: {course.tuition_fee:,.0f} VNĐ\n\n"
                    f"Trung tâm sẽ sắp xếp lớp học cho bạn trong thời gian sớm nhất.\n"
                    f"Trân trọng,\nĐội ngũ FourGuys."
                )
                send_automated_email(subject, message, [student.user.email])
                print(f"[EMAIL] Đã gửi email đăng ký khóa học tới {student.user.email}")
        except Exception as email_err:
            print(f"[EMAIL ERROR] Lỗi gửi email đăng ký: {str(email_err)}")

    def perform_update(self, serializer):
        """Override để gửi email khi điểm được cập nhật"""
        old_instance = self.get_object()
        old_grades = (old_instance.attendance_grade, old_instance.midterm_grade, old_instance.final_test_grade)

        instance = serializer.save()
        new_grades = (instance.attendance_grade, instance.midterm_grade, instance.final_test_grade)

        # Nếu có thay đổi điểm -> gửi email
        if old_grades != new_grades and instance.classroom:
            try:
                from apps.accounts.utils import send_grade_email
                student = instance.student
                if student.user.email:
                    send_grade_email(
                        student=student,
                        classroom=instance.classroom,
                        enrollment=instance
                    )
            except Exception as email_err:
                print(f"Lỗi gửi email điểm: {str(email_err)}")

    def get_queryset(self):
        user = self.request.user
        queryset = Enrollment.objects.select_related('student__user', 'classroom__course', 'classroom__teacher__user').all()
        
        role = getattr(user, 'role', '')
        if role == 'student':
            if hasattr(user, 'student_profile'):
                return queryset.filter(student=user.student_profile)
            return queryset.none()
            
        if role == 'teacher':
            if hasattr(user, 'teacher_profile'):
                return queryset.filter(classroom__teacher=user.teacher_profile)
            return queryset.none()
            
        return queryset.order_by('student__user__first_name', 'student__user__last_name')
