"""
Views - API endpoints cho attendance
Nghiệp vụ: Chọn lớp → Chọn buổi học → Điểm danh học viên
"""
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Q

from .models import AttendanceSession, AttendanceRecord
from .serializers import (
    AttendanceSessionSerializer, AttendanceSessionListSerializer,
    AttendanceRecordSerializer, BulkAttendanceSerializer
)
from apps.accounts.permissions import IsStaffOrAdmin, IsTeacher
from apps.courses.models import ClassRoom, Enrollment


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
