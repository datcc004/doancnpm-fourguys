"""
Models - Quản lý khóa học, lớp học, đăng ký
"""
from django.db import models
from apps.accounts.models import Teacher, Student


class Course(models.Model):
    """Khóa học"""
    LANGUAGE_CHOICES = [
        ('english', 'Tiếng Anh'),
        ('japanese', 'Tiếng Nhật'),
        ('korean', 'Tiếng Hàn'),
        ('chinese', 'Tiếng Trung'),
        ('french', 'Tiếng Pháp'),
        ('german', 'Tiếng Đức'),
        ('other', 'Khác'),
    ]

    LEVEL_CHOICES = [
        ('beginner', 'Sơ cấp'),
        ('elementary', 'Cơ bản'),
        ('intermediate', 'Trung cấp'),
        ('upper_intermediate', 'Trung cấp cao'),
        ('advanced', 'Cao cấp'),
    ]

    name = models.CharField(max_length=200, verbose_name='Tên khóa học')
    code = models.CharField(max_length=20, unique=True, verbose_name='Mã khóa học')
    language = models.CharField(max_length=20, choices=LANGUAGE_CHOICES, default='english', verbose_name='Ngôn ngữ')
    level = models.CharField(max_length=30, choices=LEVEL_CHOICES, default='beginner', verbose_name='Trình độ')
    description = models.TextField(blank=True, null=True, verbose_name='Mô tả')
    duration_weeks = models.IntegerField(default=12, verbose_name='Thời lượng (tuần)')
    total_hours = models.IntegerField(default=36, verbose_name='Tổng số giờ')
    tuition_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Học phí')
    max_students = models.IntegerField(default=30, verbose_name='Số HV tối đa')
    is_active = models.BooleanField(default=True, verbose_name='Đang mở')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'courses'
        verbose_name = 'Khóa học'
        verbose_name_plural = 'Khóa học'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} - {self.name}"


class ClassRoom(models.Model):
    """Lớp học"""
    STATUS_CHOICES = [
        ('upcoming', 'Sắp khai giảng'),
        ('active', 'Đang học'),
        ('completed', 'Đã kết thúc'),
        ('cancelled', 'Đã hủy'),
    ]

    MODE_CHOICES = [
        ('offline', 'Tại trung tâm (Offline)'),
        ('online', 'Trực tuyến (Online)'),
    ]

    name = models.CharField(max_length=100, verbose_name='Tên lớp')
    code = models.CharField(max_length=20, unique=True, verbose_name='Mã lớp')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='classrooms', verbose_name='Khóa học')
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='classes', verbose_name='Giảng viên')
    room = models.CharField(max_length=50, blank=True, null=True, verbose_name='Phòng học')
    schedule = models.CharField(max_length=200, blank=True, null=True, verbose_name='Lịch học')
    learning_mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='offline', verbose_name='Hình thức học')
    start_date = models.DateField(verbose_name='Ngày bắt đầu')
    end_date = models.DateField(verbose_name='Ngày kết thúc')
    start_time = models.TimeField(null=True, blank=True, verbose_name='Giờ bắt đầu')
    end_time = models.TimeField(null=True, blank=True, verbose_name='Giờ kết thúc')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='upcoming', verbose_name='Trạng thái')
    max_students = models.IntegerField(default=30, verbose_name='Số HV tối đa')
    notes = models.TextField(blank=True, null=True, verbose_name='Ghi chú')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'classes'
        verbose_name = 'Lớp học'
        verbose_name_plural = 'Lớp học'
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def current_students(self):
        """Số học viên hiện tại"""
        return self.enrollments.filter(status='active').count()

    @property
    def is_full(self):
        """Lớp đã đầy chưa"""
        return self.current_students >= self.max_students


class Enrollment(models.Model):
    """Đăng ký lớp học"""
    STATUS_CHOICES = [
        ('active', 'Đang học'),
        ('completed', 'Hoàn thành'),
        ('dropped', 'Đã nghỉ'),
        ('suspended', 'Tạm nghỉ'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments', verbose_name='Học viên')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='enrollments', verbose_name='Lớp học')
    enrollment_date = models.DateField(auto_now_add=True, verbose_name='Ngày đăng ký')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='Trạng thái')
    final_grade = models.DecimalField(max_digits=4, decimal_places=1, blank=True, null=True, verbose_name='Điểm cuối')
    notes = models.TextField(blank=True, null=True, verbose_name='Ghi chú')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'enrollments'
        verbose_name = 'Đăng ký lớp'
        verbose_name_plural = 'Đăng ký lớp'
        unique_together = ['student', 'classroom']

    def __str__(self):
        return f"{self.student} - {self.classroom}"
