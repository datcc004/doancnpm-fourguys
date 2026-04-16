"""
Views - API endpoints cho courses
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Avg
from django.db import transaction

from .models import Course, ClassRoom, Enrollment, TestScore
from .serializers import (
    CourseSerializer, ClassRoomSerializer, ClassRoomDetailSerializer,
    EnrollmentSerializer, TestScoreSerializer, BulkTestScoreSerializer
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

    def get_queryset(self):
        # Tự động cập nhật các lớp hết hạn trước khi list
        from .services import CourseService
        CourseService.auto_complete_expired_classes()
        
        user = self.request.user
        queryset = ClassRoom.objects.select_related('course', 'teacher__user')
        
        # Nếu là giảng viên -> Chỉ thấy lớp mình dạy
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            return queryset.filter(teacher=user.teacher_profile)
            
        # Nếu là học viên -> Chỉ thấy lớp mình đã/đang học
        if user.role == 'student' and hasattr(user, 'student_profile'):
            return queryset.filter(enrollments__student=user.student_profile).distinct()
            
        return queryset.all()

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
            deposit_amount = request.data.get('deposit_amount', 0)
            
            # Gọi Service để xử lý logic nghiệp vụ
            enrollment, payment = CourseService.enroll_student(
                student_id=student_id, 
                classroom_id=classroom.id,
                deposit_amount=deposit_amount,
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
        from .services import CourseService
        # Tự động đóng lớp khi hết thời gian
        CourseService.auto_complete_expired_classes()
        
        user = request.user
        
        # Nếu là Admin/Staff -> Trả về tất cả các lớp đang mở (để xem lịch tổng quát)
        if user.role in ['admin', 'staff']:
            classrooms = ClassRoom.objects.filter(status__in=['active', 'upcoming']).select_related('course', 'teacher__user')
            return Response(ClassRoomSerializer(classrooms, many=True).data)
            
        # Nếu là Giảng viên -> Trả về các lớp đang dạy và đã dạy
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            teacher = user.teacher_profile
            classrooms = ClassRoom.objects.filter(teacher=teacher, status__in=['active', 'upcoming', 'completed']).select_related('course', 'teacher__user')
            return Response(ClassRoomSerializer(classrooms, many=True).data)
            
        # Nếu là Học viên -> Trả về lớp đã đăng ký và hoàn thành
        if user.role == 'student' and hasattr(user, 'student_profile'):
            student = user.student_profile
            enrollments = Enrollment.objects.filter(
                student=student, 
                status__in=['active', 'completed'],
                classroom__isnull=False
            ).select_related('classroom__course', 'classroom__teacher__user')
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
    filterset_fields = ['status', 'classroom', 'student', 'payment_status', 'approval_status']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'create']:
            return [IsAuthenticated()]
        # Cho phép Giảng viên cập nhật
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

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Admin duyệt đăng ký ghi danh"""
        enrollment = self.get_object()
        enrollment.approval_status = 'approved'
        enrollment.save(update_fields=['approval_status'])
        return Response(EnrollmentSerializer(enrollment).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Admin từ chối đăng ký ghi danh"""
        enrollment = self.get_object()
        enrollment.approval_status = 'rejected'
        enrollment.save(update_fields=['approval_status'])
        return Response(EnrollmentSerializer(enrollment).data)

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


class TestScoreViewSet(viewsets.ModelViewSet):
    """CRUD cho TestScore - Quản lý điểm Test"""
    serializer_class = TestScoreSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['classroom', 'student', 'test_type']

    def get_queryset(self):
        user = self.request.user
        queryset = TestScore.objects.select_related('student__user', 'classroom__course').all()

        if user.role == 'student' and hasattr(user, 'student_profile'):
            return queryset.filter(student=user.student_profile)

        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            return queryset.filter(classroom__teacher=user.teacher_profile)

        return queryset

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'student_report', 'class_summary']:
            return [IsAuthenticated()]
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'bulk_create']:
            from apps.accounts.permissions import IsStaffOrAdmin, IsTeacher
            return [IsAuthenticated(), (IsStaffOrAdmin | IsTeacher)()]
        return [IsAuthenticated(), IsStaffOrAdmin()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_create(self, request):
        """Nhập điểm hàng loạt cho cả lớp"""
        serializer = BulkTestScoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        classroom = ClassRoom.objects.get(id=data['classroom_id'])

        # Kiểm tra quyền GV
        if request.user.role == 'teacher' and classroom.teacher.user != request.user:
            return Response({'error': 'Bạn không được phân công dạy lớp này'}, status=status.HTTP_403_FORBIDDEN)

        created_count = 0
        updated_count = 0
        for item in data['scores']:
            obj, created = TestScore.objects.update_or_create(
                student_id=item['student_id'],
                classroom=classroom,
                test_name=data['test_name'],
                defaults={
                    'test_type': data['test_type'],
                    'score': item['score'],
                    'max_score': data['max_score'],
                    'test_date': data['test_date'],
                    'notes': item.get('notes', ''),
                    'created_by': request.user,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        return Response({
            'message': f'Đã lưu {created_count} bản ghi mới, cập nhật {updated_count} bản ghi.',
            'created': created_count,
            'updated': updated_count,
        })

    @action(detail=False, methods=['get'])
    def by_class(self, request):
        """Danh sách điểm theo lớp học"""
        classroom_id = request.query_params.get('classroom_id')
        if not classroom_id:
            return Response({'error': 'Thiếu classroom_id'}, status=status.HTTP_400_BAD_REQUEST)

        scores = self.get_queryset().filter(classroom_id=classroom_id).order_by('student__user__last_name', 'test_date')
        return Response(TestScoreSerializer(scores, many=True).data)

    @action(detail=False, methods=['get'])
    def student_report(self, request):
        """Báo cáo điểm của một học viên trong một lớp"""
        student_id = request.query_params.get('student_id')
        classroom_id = request.query_params.get('classroom_id')

        if not student_id:
            return Response({'error': 'Thiếu student_id'}, status=status.HTTP_400_BAD_REQUEST)

        scores = TestScore.objects.filter(student_id=student_id)
        if classroom_id:
            scores = scores.filter(classroom_id=classroom_id)

        scores_data = TestScoreSerializer(scores.order_by('test_date'), many=True).data

        # Tính điểm tổng kết
        midterm_scores = scores.filter(test_type='midterm')
        final_scores = scores.filter(test_type='final')
        all_scores = scores.all()

        avg_midterm = None
        avg_final = None
        avg_all = None

        if midterm_scores.exists():
            avg_midterm = round(float(midterm_scores.aggregate(avg=Avg('score'))['avg'] or 0), 2)
        if final_scores.exists():
            avg_final = round(float(final_scores.aggregate(avg=Avg('score'))['avg'] or 0), 2)
        if all_scores.exists():
            # Tính trung bình tất cả bài test (quy hệ 10)
            total = 0
            count = 0
            for s in all_scores:
                total += s.score_10
                count += 1
            avg_all = round(total / count, 2) if count > 0 else None

        # Tính điểm tổng kết theo trọng số: Giữa kỳ 30%, Cuối kỳ 70%
        final_grade = None
        if avg_midterm is not None and avg_final is not None:
            final_grade = round(avg_midterm * 0.3 + avg_final * 0.7, 2)
        elif avg_all is not None:
            final_grade = avg_all

        # Letter grade
        letter_grade = '-'
        if final_grade is not None:
            if final_grade >= 8.5: letter_grade = 'A'
            elif final_grade >= 7.8: letter_grade = 'B+'
            elif final_grade >= 7.0: letter_grade = 'B'
            elif final_grade >= 6.3: letter_grade = 'C+'
            elif final_grade >= 5.5: letter_grade = 'C'
            elif final_grade >= 4.8: letter_grade = 'D+'
            elif final_grade >= 4.0: letter_grade = 'D'
            else: letter_grade = 'F'

        return Response({
            'scores': scores_data,
            'total_tests': scores.count(),
            'avg_midterm': avg_midterm,
            'avg_final': avg_final,
            'avg_all': avg_all,
            'final_grade': final_grade,
            'letter_grade': letter_grade,
        })

    @action(detail=False, methods=['get'])
    def class_summary(self, request):
        """Tổng kết điểm toàn lớp"""
        classroom_id = request.query_params.get('classroom_id')
        if not classroom_id:
            return Response({'error': 'Thiếu classroom_id'}, status=status.HTTP_400_BAD_REQUEST)

        # Unique test names in this class
        test_names = TestScore.objects.filter(
            classroom_id=classroom_id
        ).values_list('test_name', flat=True).distinct().order_by('test_name')

        # All students in this class
        enrollments = Enrollment.objects.filter(
            classroom_id=classroom_id, status='active'
        ).select_related('student__user')

        students_data = []
        for e in enrollments:
            student = e.student
            scores = TestScore.objects.filter(student=student, classroom_id=classroom_id)
            
            # Build scores map
            scores_map = {}
            for s in scores:
                scores_map[s.test_name] = {
                    'id': s.id,
                    'score': float(s.score),
                    'max_score': float(s.max_score),
                    'score_10': s.score_10,
                }

            # Calculate averages
            midterms = scores.filter(test_type='midterm')
            finals = scores.filter(test_type='final')
            
            avg_mid = round(float(midterms.aggregate(avg=Avg('score'))['avg'] or 0), 2) if midterms.exists() else None
            avg_fin = round(float(finals.aggregate(avg=Avg('score'))['avg'] or 0), 2) if finals.exists() else None

            final_grade = None
            if avg_mid is not None and avg_fin is not None:
                final_grade = round(avg_mid * 0.3 + avg_fin * 0.7, 2)
            elif scores.exists():
                total = sum(s.score_10 for s in scores)
                final_grade = round(total / scores.count(), 2)

            letter = '-'
            if final_grade is not None:
                if final_grade >= 8.5: letter = 'A'
                elif final_grade >= 7.8: letter = 'B+'
                elif final_grade >= 7.0: letter = 'B'
                elif final_grade >= 6.3: letter = 'C+'
                elif final_grade >= 5.5: letter = 'C'
                elif final_grade >= 4.8: letter = 'D+'
                elif final_grade >= 4.0: letter = 'D'
                else: letter = 'F'

            user = student.user
            students_data.append({
                'student_id': student.id,
                'student_name': f"{user.last_name} {user.first_name}".strip(),
                'student_code': student.student_code,
                'scores': scores_map,
                'avg_midterm': avg_mid,
                'avg_final': avg_fin,
                'final_grade': final_grade,
                'letter_grade': letter,
            })

        return Response({
            'test_names': list(test_names),
            'students': students_data,
        })
