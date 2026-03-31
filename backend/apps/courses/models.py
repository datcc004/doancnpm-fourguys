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
    total_lessons = models.IntegerField(default=24, verbose_name='Số tiết học')
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
    total_lessons = models.IntegerField(null=True, blank=True, verbose_name='Số tiết học')
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

    def save(self, *args, **kwargs):
        if not self.total_lessons and self.course:
            self.total_lessons = self.course.total_lessons
        super().save(*args, **kwargs)

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
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name='enrollments', verbose_name='Khóa học')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='enrollments', verbose_name='Lớp học')
    enrollment_date = models.DateField(auto_now_add=True, verbose_name='Ngày đăng ký')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='Trạng thái')
    attendance_grade = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, verbose_name='Điểm chuyên cần (10%)')
    midterm_grade = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, verbose_name='Điểm giữa kỳ (20%)')
    final_test_grade = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, verbose_name='Điểm cuối kỳ (70%)')
    notes = models.TextField(blank=True, null=True, verbose_name='Ghi chú')
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def final_grade(self):
        """Tính điểm tổng kết dựa trên trọng số: 10% - 20% - 70%"""
        if not self.classroom: return None
        if self.attendance_grade is not None and self.midterm_grade is not None and self.final_test_grade is not None:
            a = float(self.attendance_grade)
            m = float(self.midterm_grade)
            f = float(self.final_test_grade)
            total = (a * 0.1) + (m * 0.2) + (f * 0.7)
            return round(total, 2)
        return None

    @property
    def letter_grade(self):
        """Chuyển đổi điểm hệ 10 sang hệ chữ (University style)"""
        score = self.final_grade
        if score is None: return "-"
        if score >= 8.5: return "A"
        if score >= 7.8: return "B+"
        if score >= 7.0: return "B"
        if score >= 6.3: return "C+"
        if score >= 5.5: return "C"
        if score >= 4.8: return "D+"
        if score >= 4.0: return "D"
        return "F"
    
    @property
    def gpa4_score(self):
        """Chuyển đổi điểm hệ 10 sang hệ 4 (University style)"""
        score = self.final_grade
        if score is None: return "-"
        if score >= 8.5: return 4.0
        if score >= 7.8: return 3.5
        if score >= 7.0: return 3.0
        if score >= 6.3: return 2.5
        if score >= 5.5: return 2.0
        if score >= 4.8: return 1.5
        if score >= 4.0: return 1.0
        return 0.0

    class Meta:
        db_table = 'enrollments'
        verbose_name = 'Đăng ký'
        verbose_name_plural = 'Đăng ký'
        # unique_together = ['student', 'course'] # Bỏ để sửa lỗi dữ liệu cũ bị trùng, xử lý logic ở Serializer

    def __str__(self):
        return f"{self.student} - {self.classroom}"
