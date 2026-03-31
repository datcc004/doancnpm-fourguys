"""
Serializers - Chuyển đổi dữ liệu cho API accounts
"""
from rest_framework import serializers
from .models import User, Student, Teacher


class UserSerializer(serializers.ModelSerializer):
    """Serializer cho User model"""
    full_name = serializers.SerializerMethodField()

    student_id = serializers.SerializerMethodField()
    teacher_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name',
                  'role', 'phone', 'address', 'date_of_birth', 'avatar',
                  'student_id', 'teacher_id',
                  'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_student_id(self, obj):
        if hasattr(obj, 'student_profile'):
            return obj.student_profile.id
        return None

    def get_teacher_id(self, obj):
        if hasattr(obj, 'teacher_profile'):
            return obj.teacher_profile.id
        return None


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer tạo user mới"""
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name',
                  'role', 'phone', 'address', 'date_of_birth']

    def create(self, validated_data):
        password = validated_data.pop('password')
        role = validated_data.get('role', 'student')
        
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        
        # Tự động tạo Student profile nếu role là student
        if role == 'student':
            import uuid
            # Tạo mã học viên tự động (VD: HV-123456)
            unique_id = str(uuid.uuid4().int)
            student_code = f"HV-{unique_id[:6]}"
            Student.objects.create(
                user=user,
                student_code=student_code,
                level='Sơ cấp'
            )
            
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer đăng nhập"""
    username = serializers.CharField()
    password = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer đổi mật khẩu"""
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=6)


class StudentSerializer(serializers.ModelSerializer):
    """Serializer cho Student"""
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Student
        fields = ['id', 'user', 'user_id', 'student_code', 'level',
                  'enrollment_date', 'notes']
        read_only_fields = ['id', 'enrollment_date']


class StudentCreateSerializer(serializers.Serializer):
    """Serializer tạo student mới (kèm tạo user)"""
    username = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False)
    student_code = serializers.CharField()
    level = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class TeacherSerializer(serializers.ModelSerializer):
    """Serializer cho Teacher"""
    user = UserSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = ['id', 'user', 'teacher_code', 'specialization', 'languages',
                  'qualification', 'experience_years', 'hourly_rate', 'bio']
        read_only_fields = ['id']


class TeacherCreateSerializer(serializers.Serializer):
    """Serializer tạo teacher mới (kèm tạo user)"""
    username = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False)
    teacher_code = serializers.CharField()
    specialization = serializers.CharField(required=False, allow_blank=True)
    languages = serializers.CharField(required=False, allow_blank=True)
    qualification = serializers.CharField(required=False, allow_blank=True)
    experience_years = serializers.IntegerField(required=False, default=0)
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    bio = serializers.CharField(required=False, allow_blank=True)
