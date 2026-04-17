"""
Views - API endpoints cho attendance
Nghiệp vụ: Chọn lớp → Chọn buổi học → Điểm danh học viên
"""
from datetime import date

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import AttendanceSession, AttendanceRecord, TeacherAttendance
from .serializers import (
    AttendanceSessionSerializer, AttendanceSessionListSerializer,
    AttendanceRecordSerializer, BulkAttendanceSerializer,
    TeacherAttendanceSerializer,
)
from apps.courses.models import ClassRoom


class AttendanceSessionViewSet(viewsets.ModelViewSet):
    """CRUD cho AttendanceSession"""
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'staff']:
            return AttendanceSession.objects.select_related('classroom').prefetch_related('records__student__user').all()
        # Đối với giáo viên, chỉ xem được buổi điểm danh của lớp mình dạy
        return AttendanceSession.objects.filter(classroom__teacher__user=user).select_related('classroom').prefetch_related('records__student__user').all()

    def get_serializer_class(self):
        if self.action == 'list':
            return AttendanceSessionListSerializer
        return AttendanceSessionSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_create(self, request):
        """Điểm danh hàng loạt cho cả lớp
        
        Luồng: Chọn buổi → Điểm danh từng HV
        Records: [{student_id, status, absence_reason?, is_excused?}]
        """
        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        # Kiểm tra quyền: Chỉ giáo viên dạy lớp này mới được điểm danh (hoặc admin/staff)
        classroom = ClassRoom.objects.get(id=data['classroom_id'])
        if request.user.role == 'teacher' and classroom.teacher.user != request.user:
            return Response({'error': 'Bạn không được phân công dạy lớp này'}, status=status.HTTP_403_FORBIDDEN)

        # Tạo session (hoặc lấy lại nếu đã tồn tại)
        session, created = AttendanceSession.objects.get_or_create(
            classroom_id=data['classroom_id'],
            session_date=data['session_date'],
            session_number=data.get('session_number', 1),
            defaults={
                'topic': data.get('topic', ''),
                'created_by': request.user
            }
        )

        # Cập nhật topic nếu đã có session
        if not created and data.get('topic'):
            session.topic = data['topic']
            session.save(update_fields=['topic'])

        # Cập nhật/tạo records cho từng HV
        for record in data['records']:
            record_status = record.get('status', 'present')
            defaults = {
                'status': record_status,
            }
            
            # Xử lý logic vắng mặt
            if record_status == 'absent':
                defaults['absence_reason'] = record.get('absence_reason', 'Không rõ')
                defaults['is_excused'] = record.get('is_excused', False)
            else:
                # Present → clear thông tin vắng
                defaults['absence_reason'] = None
                defaults['is_excused'] = False

            AttendanceRecord.objects.update_or_create(
                session=session,
                student_id=record['student_id'],
                defaults=defaults
            )

        # ---- Gửi email cho học viên vắng ----
        try:
            from apps.accounts.utils import send_attendance_email
            from apps.accounts.models import Student
            for record in data['records']:
                if record.get('status') == 'absent':
                    try:
                        student = Student.objects.select_related('user').get(id=record['student_id'])
                        if student.user.email:
                            excused_text = "Có phép" if record.get('is_excused') else "Không phép"
                            send_attendance_email(
                                student=student,
                                classroom=classroom,
                                session_date=data['session_date'],
                                status_display=f"Vắng mặt ({excused_text})",
                                session_number=data.get('session_number', 1)
                            )
                    except Student.DoesNotExist:
                        pass
        except Exception as email_err:
            print(f"Lỗi gửi email điểm danh: {str(email_err)}")

        return Response(
            AttendanceSessionSerializer(session).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def by_class(self, request):
        """Lấy danh sách buổi điểm danh theo lớp"""
        classroom_id = request.query_params.get('classroom_id')
        if not classroom_id:
            return Response({'error': 'Thiếu classroom_id'}, status=status.HTTP_400_BAD_REQUEST)

        # Kiểm tra quyền: Nếu là giáo viên, chỉ xem được lớp mình dạy
        if request.user.role == 'teacher':
            try:
                classroom = ClassRoom.objects.get(id=classroom_id)
                if classroom.teacher.user != request.user:
                    return Response({'error': 'Bạn không có quyền xem lớp này'}, status=status.HTTP_403_FORBIDDEN)
            except ClassRoom.DoesNotExist:
                return Response({'error': 'Lớp học không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        session_date = request.query_params.get('session_date')
        sessions = self.get_queryset().filter(classroom_id=classroom_id)
        
        if session_date and session_date.strip():
            sessions = sessions.filter(session_date=session_date)

        return Response(AttendanceSessionListSerializer(sessions.order_by('session_number'), many=True).data)

    @action(detail=False, methods=['get'])
    def session_detail(self, request):
        """Lấy chi tiết một buổi điểm danh theo session_id
        Trả về danh sách HV và trạng thái điểm danh
        """
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'error': 'Thiếu session_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = AttendanceSession.objects.select_related('classroom').prefetch_related(
                'records__student__user'
            ).get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return Response({'error': 'Buổi học không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        return Response(AttendanceSessionSerializer(session).data)

    @action(detail=False, methods=['get'])
    def student_report(self, request):
        """Báo cáo điểm danh của một học viên"""
        student_id = request.query_params.get('student_id')
        classroom_id = request.query_params.get('classroom_id')

        if not student_id:
            return Response({'error': 'Thiếu student_id'}, status=status.HTTP_400_BAD_REQUEST)

        records = AttendanceRecord.objects.filter(student_id=student_id)
        if classroom_id:
            records = records.filter(session__classroom_id=classroom_id)

        total = records.count()
        present = records.filter(status='present').count()
        absent = records.filter(status='absent').count()
        absent_excused = records.filter(status='absent', is_excused=True).count()
        absent_unexcused = records.filter(status='absent', is_excused=False).count()

        return Response({
            'total_sessions': total,
            'present': present,
            'absent': absent,
            'absent_excused': absent_excused,
            'absent_unexcused': absent_unexcused,
            'attendance_rate': round(present / total * 100, 1) if total > 0 else 0,
            'records': AttendanceRecordSerializer(records.order_by('-session__session_date'), many=True).data
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Lịch sử điểm danh theo lớp - tìm kiếm theo tên HV"""
        classroom_id = request.query_params.get('classroom_id')
        search = request.query_params.get('search', '').strip()

        if not classroom_id:
            return Response({'error': 'Thiếu classroom_id'}, status=status.HTTP_400_BAD_REQUEST)

        sessions = AttendanceSession.objects.filter(
            classroom_id=classroom_id
        ).select_related('classroom').prefetch_related(
            'records__student__user'
        ).order_by('session_number')

        if search:
            sessions = sessions.filter(
                Q(records__student__user__first_name__icontains=search) |
                Q(records__student__user__last_name__icontains=search) |
                Q(records__student__student_code__icontains=search)
            ).distinct()

        return Response(AttendanceSessionListSerializer(sessions, many=True).data)


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    """CRUD cho AttendanceRecord"""
    queryset = AttendanceRecord.objects.select_related('session', 'student__user').all()
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['session', 'student', 'status']


def _parse_work_date(value):
    if value is None or value == '':
        return timezone.localdate()
    if isinstance(value, date):
        return value
    parsed = parse_date(str(value))
    return parsed if parsed else timezone.localdate()


class TeacherAttendanceViewSet(viewsets.ModelViewSet):
    """API chấm công giảng viên (theo ngày).

    - Admin/Staff: xem và chỉnh sửa toàn bộ.
    - Giảng viên: chỉ bản ghi của mình; tạo/sửa không đổi được ``teacher``.
    - Xóa: chỉ admin/staff.
    """
    serializer_class = TeacherAttendanceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['teacher', 'work_date', 'status']
    ordering_fields = ['work_date', 'created_at', 'check_in']
    ordering = ['-work_date', 'id']
    search_fields = ['teacher__teacher_code', 'teacher__user__first_name', 'teacher__user__last_name']

    def get_queryset(self):
        qs = TeacherAttendance.objects.select_related('teacher__user', 'recorded_by').all()
        user = self.request.user
        role = getattr(user, 'role', None)
        if role in ('admin', 'staff'):
            return qs
        if role == 'teacher':
            teacher = getattr(user, 'teacher_profile', None)
            if teacher:
                return qs.filter(teacher=teacher)
        return qs.none()

    def create(self, request, *args, **kwargs):
        if request.user.role not in ('admin', 'staff', 'teacher'):
            return Response(
                {'detail': 'Không có quyền tạo chấm công'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'teacher':
            teacher = getattr(user, 'teacher_profile', None)
            if not teacher:
                raise ValidationError({'detail': 'Tài khoản không có hồ sơ giảng viên'})
            serializer.save(teacher=teacher, recorded_by=user)
        else:
            serializer.save(recorded_by=user)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('admin', 'staff'):
            return Response(
                {'detail': 'Chỉ quản trị/nhân viên được xóa bản ghi chấm công'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='clock-in')
    def clock_in(self, request):
        """Giảng viên chấm giờ vào (tạo hoặc cập nhật bản ghi ngày hiện tại)."""
        if request.user.role != 'teacher':
            return Response({'detail': 'Chỉ giảng viên được chấm vào'}, status=status.HTTP_403_FORBIDDEN)
        teacher = getattr(request.user, 'teacher_profile', None)
        if not teacher:
            return Response({'detail': 'Không có hồ sơ giảng viên'}, status=status.HTTP_400_BAD_REQUEST)

        work_date = _parse_work_date(request.data.get('work_date'))
        now = timezone.now()
        obj, _created = TeacherAttendance.objects.get_or_create(
            teacher=teacher,
            work_date=work_date,
            defaults={
                'check_in': now,
                'status': 'present',
                'recorded_by': request.user,
            },
        )
        if obj.check_in is None:
            obj.check_in = now
            obj.recorded_by = request.user
            obj.save(update_fields=['check_in', 'recorded_by', 'updated_at'])
        return Response(TeacherAttendanceSerializer(obj).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='clock-out')
    def clock_out(self, request):
        """Giảng viên chấm giờ ra."""
        if request.user.role != 'teacher':
            return Response({'detail': 'Chỉ giảng viên được chấm ra'}, status=status.HTTP_403_FORBIDDEN)
        teacher = getattr(request.user, 'teacher_profile', None)
        if not teacher:
            return Response({'detail': 'Không có hồ sơ giảng viên'}, status=status.HTTP_400_BAD_REQUEST)

        work_date = _parse_work_date(request.data.get('work_date'))
        try:
            obj = TeacherAttendance.objects.get(teacher=teacher, work_date=work_date)
        except TeacherAttendance.DoesNotExist:
            return Response(
                {'detail': 'Chưa có bản ghi chấm công trong ngày, hãy chấm vào trước'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.check_out = timezone.now()
        obj.save(update_fields=['check_out', 'updated_at'])
        return Response(TeacherAttendanceSerializer(obj).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Thống kê nhanh theo khoảng ngày (admin/staff)."""
        if request.user.role not in ('admin', 'staff'):
            return Response({'detail': 'Không có quyền'}, status=status.HTTP_403_FORBIDDEN)
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        teacher_id = request.query_params.get('teacher')
        qs = TeacherAttendance.objects.all()
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)
        if from_date:
            d = parse_date(from_date)
            if d:
                qs = qs.filter(work_date__gte=d)
        if to_date:
            d = parse_date(to_date)
            if d:
                qs = qs.filter(work_date__lte=d)
        total = qs.count()
        by_status = {}
        for code, label in TeacherAttendance.STATUS_CHOICES:
            by_status[code] = qs.filter(status=code).count()
        return Response({
            'total_records': total,
            'by_status': by_status,
        })
