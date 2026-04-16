"""
Views - API endpoints cho accounts
"""
from rest_framework import status, generics, viewsets
from rest_framework.decorators import api_view, permission_classes, action, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate
from django.db import transaction

from .models import User, Student, Teacher
from .serializers import (
    UserSerializer, UserCreateSerializer, LoginSerializer,
    ChangePasswordSerializer, StudentSerializer, StudentCreateSerializer,
    TeacherSerializer, TeacherCreateSerializer
)
from .authentication import generate_token
from .permissions import IsAdmin, IsStaffOrAdmin, IsOwnerOrAdmin

# Dashboard imports
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import timedelta


# ==================== AUTH VIEWS ====================

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Đăng ký tài khoản mới"""
    serializer = UserCreateSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token = generate_token(user)
        return Response({
            'message': 'Đăng ký thành công',
            'token': token,
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Đăng nhập"""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )
        if user is None:
            return Response(
                {'error': 'Tên đăng nhập hoặc mật khẩu không đúng'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not user.is_active:
            return Response(
                {'error': 'Tài khoản đã bị khóa'},
                status=status.HTTP_403_FORBIDDEN
            )
        token = generate_token(user)
        return Response({
            'message': 'Đăng nhập thành công',
            'token': token,
            'user': UserSerializer(user).data
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Lấy thông tin user hiện tại"""
    return Response(UserSerializer(request.user).data)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def update_profile(request):
    """Cập nhật thông tin cá nhân"""
    serializer = UserSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Đổi mật khẩu"""
    serializer = ChangePasswordSerializer(data=request.data)
    if serializer.is_valid():
        if not request.user.check_password(serializer.validated_data['old_password']):
            return Response({'error': 'Mật khẩu cũ không đúng'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'message': 'Đổi mật khẩu thành công'})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Thống kê cho dashboard tối ưu hóa"""
    from apps.courses.models import Course, ClassRoom, Enrollment
    from apps.payments.models import Payment

    # 1. Các thống kê cơ bản
    stats = {
        'total_students': Student.objects.count(),
        'total_teachers': Teacher.objects.count(),
        'total_courses': Course.objects.filter(is_active=True).count(),
        'total_classes': ClassRoom.objects.filter(status='active').count(),
        'total_enrollments': Enrollment.objects.count(),
    }

    # 2. Tổng doanh thu (paid)
    revenue = Payment.objects.filter(status='paid').aggregate(total=Sum('amount'))
    stats['total_revenue'] = float(revenue['total'] or 0)

    # 3. Thống kê theo tháng (6 tháng gần nhất)
    today = timezone.now().date().replace(day=1)
    six_months_ago = today - timedelta(days=155) # Lùi khoảng hơn 5 tháng
    
    monthly_payments = Payment.objects.filter(
        status='paid',
        payment_date__gte=six_months_ago
    ).annotate(
        month_trunc=TruncMonth('payment_date')
    ).values('month_trunc').annotate(
        total=Sum('amount'),
        count=Count('id')
    ).order_by('month_trunc')

    # Chuyển kết quả sang format frontend cần
    monthly_data = []
    # Chuyển QuerySet thành dict để tra cứu nhanh và an toàn
    payment_dict = {}
    for p in monthly_payments:
        if p['month_trunc']:
            # Đảm bảo month_trunc là datetime object
            m_date = p['month_trunc']
            key = f"{m_date.month:02d}/{m_date.year}"
            payment_dict[key] = p

    for i in range(5, -1, -1):
        # Tính toán tháng mục tiêu thủ công để tránh lệch ngày
        current_date = timezone.now()
        # Lùi i tháng
        year = current_date.year
        month = current_date.month - i
        while month <= 0:
            month += 12
            year -= 1
        
        month_str = f"{month:02d}/{year}"
        db_month = payment_dict.get(month_str)
        
        monthly_data.append({
            'month': month_str,
            'revenue': float(db_month['total'] or 0) if db_month else 0,
            'count': db_month['count'] if db_month else 0
        })
    stats['monthly_revenue'] = monthly_data

    # 4. Top 5 khóa học có nhiều học viên nhất
    top_courses = Course.objects.annotate(
        student_count=Count('classrooms__enrollments')
    ).order_by('-student_count')[:5]
    
    stats['top_courses'] = [
        {'name': c.name, 'students': c.student_count}
        for c in top_courses
    ]

    return Response(stats)


# ==================== USER MANAGEMENT ====================

class UserViewSet(viewsets.ModelViewSet):
    """CRUD cho User (chỉ admin)"""
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsStaffOrAdmin]
    search_fields = ['username', 'email', 'first_name', 'last_name', 'phone']
    filterset_fields = ['role', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def perform_destroy(self, instance):
        # Soft delete - chỉ vô hiệu hóa
        instance.is_active = False
        instance.save()


# ==================== STUDENT MANAGEMENT ====================

class StudentViewSet(viewsets.ModelViewSet):
    """CRUD cho Student"""
    queryset = Student.objects.select_related('user').all()
    serializer_class = StudentSerializer
    search_fields = ['student_code', 'user__first_name', 'user__last_name', 'user__email']
    filterset_fields = ['level']

    def get_permissions(self):
        if self.action == 'retrieve':
            from rest_framework.permissions import IsAuthenticated
            return [IsAuthenticated()]
        from .permissions import IsStaffOrAdmin
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated(), IsStaffOrAdmin()]

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.role not in ['admin', 'staff'] and obj.user != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Bạn không có quyền xem thông tin này.")
        return obj

    def get_serializer_class(self):
        if self.action == 'create':
            return StudentCreateSerializer
        return StudentSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Tạo student mới kèm user account"""
        serializer = StudentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Tạo user
        user = User(
            username=data['username'],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data.get('phone', ''),
            address=data.get('address', ''),
            date_of_birth=data.get('date_of_birth'),
            role='student'
        )
        user.set_password(data['password'])
        user.save()

        # Tạo student profile
        student = Student.objects.create(
            user=user,
            student_code=data['student_code'],
            level=data.get('level', ''),
            notes=data.get('notes', '')
        )

        return Response(StudentSerializer(student).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Cập nhật student và user"""
        student = self.get_object()
        data = request.data

        # Cập nhật user info
        user = student.user
        for field in ['first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth']:
            if field in data:
                val = data[field]
                if field == 'date_of_birth' and not val:
                    val = None
                setattr(user, field, val)
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        user.save()

        # Cập nhật student info
        for field in ['student_code', 'level', 'notes']:
            if field in data:
                setattr(student, field, data[field])
        student.save()

        return Response(StudentSerializer(student).data)


# ==================== TEACHER MANAGEMENT ====================

class TeacherViewSet(viewsets.ModelViewSet):
    """CRUD cho Teacher"""
    queryset = Teacher.objects.select_related('user').all()
    serializer_class = TeacherSerializer
    search_fields = ['teacher_code', 'user__first_name', 'user__last_name', 'specialization']
    filterset_fields = ['specialization']

    def get_permissions(self):
        if self.action == 'retrieve':
            from rest_framework.permissions import IsAuthenticated
            return [IsAuthenticated()]
        from .permissions import IsStaffOrAdmin
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated(), IsStaffOrAdmin()]

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.role not in ['admin', 'staff'] and obj.user != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Bạn không có quyền xem thông tin này.")
        return obj

    def get_serializer_class(self):
        if self.action == 'create':
            return TeacherCreateSerializer
        return TeacherSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Tạo teacher mới kèm user account"""
        serializer = TeacherCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User(
            username=data['username'],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data.get('phone', ''),
            address=data.get('address', ''),
            date_of_birth=data.get('date_of_birth'),
            role='teacher'
        )
        user.set_password(data['password'])
        user.save()

        teacher = Teacher.objects.create(
            user=user,
            teacher_code=data['teacher_code'],
            specialization=data.get('specialization', ''),
            languages=data.get('languages', ''),
            qualification=data.get('qualification', ''),
            experience_years=data.get('experience_years', 0),
            hourly_rate=data.get('hourly_rate', 0),
            bio=data.get('bio', '')
        )

        return Response(TeacherSerializer(teacher).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Cập nhật teacher và user"""
        teacher = self.get_object()
        data = request.data

        user = teacher.user
        for field in ['first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth']:
            if field in data:
                val = data[field]
                if field == 'date_of_birth' and not val:
                    val = None
                setattr(user, field, val)
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        user.save()

        for field in ['teacher_code', 'specialization', 'languages', 'qualification', 'experience_years', 'hourly_rate', 'bio']:
            if field in data:
                val = data[field]
                if field in ['experience_years', 'hourly_rate'] and not val:
                    val = 0
                setattr(teacher, field, val)
        teacher.save()

        return Response(TeacherSerializer(teacher).data)
