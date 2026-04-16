"""
Models - Quản lý tài khoản người dùng
Bao gồm: User, Student, Teacher
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom User model với phân quyền role"""
    ROLE_CHOICES = [
        ('admin', 'Quản trị viên'),
        ('staff', 'Nhân viên'),
        ('teacher', 'Giảng viên'),
        ('student', 'Học viên'),
    ]

    GENDER_CHOICES = [
        ('male', 'Nam'),
        ('female', 'Nữ'),
        ('other', 'Khác'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student', verbose_name='Vai trò')
    phone = models.CharField(max_length=15, blank=True, null=True, verbose_name='Số điện thoại')
    address = models.TextField(blank=True, null=True, verbose_name='Địa chỉ')
    hometown = models.CharField(max_length=255, blank=True, null=True, verbose_name='Quê quán')
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True, verbose_name='Giới tính')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name='Ảnh đại diện')
    date_of_birth = models.DateField(blank=True, null=True, verbose_name='Ngày sinh')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'Người dùng'
        verbose_name_plural = 'Người dùng'

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"


class Student(models.Model):
    """Thông tin chi tiết học viên"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    student_code = models.CharField(max_length=20, unique=True, verbose_name='Mã học viên')
    level = models.CharField(max_length=50, blank=True, null=True, verbose_name='Trình độ')
    enrollment_date = models.DateField(auto_now_add=True, verbose_name='Ngày đăng ký')
    notes = models.TextField(blank=True, null=True, verbose_name='Ghi chú')

    class Meta:
        db_table = 'students'
        verbose_name = 'Học viên'
        verbose_name_plural = 'Học viên'

    def __str__(self):
        return f"{self.student_code} - {self.user.get_full_name()}"


class Teacher(models.Model):
    """Thông tin chi tiết giảng viên"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')
    teacher_code = models.CharField(max_length=20, unique=True, verbose_name='Mã giảng viên')
    specialization = models.CharField(max_length=100, blank=True, null=True, verbose_name='Chuyên môn')
    languages = models.CharField(max_length=200, blank=True, null=True, verbose_name='Ngôn ngữ giảng dạy', help_text='Ví dụ: Tiếng Anh, Tiếng Nhật (ngăn cách bằng dấu phẩy)')
    qualification = models.CharField(max_length=200, blank=True, null=True, verbose_name='Bằng cấp')
    experience_years = models.IntegerField(default=0, verbose_name='Số năm kinh nghiệm')
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Lương/giờ')
    bio = models.TextField(blank=True, null=True, verbose_name='Giới thiệu')

    class Meta:
        db_table = 'teachers'
        verbose_name = 'Giảng viên'
        verbose_name_plural = 'Giảng viên'

    def __str__(self):
        return f"{self.teacher_code} - {self.user.get_full_name()}"
