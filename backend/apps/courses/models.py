"""
Models - Quản lý khóa học, lớp học, đăng ký, điểm Test
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
    """Đăng ký lớp học
    
    Luồng: Đăng ký ghi danh → Nộp tiền (đặt cọc) → Admin duyệt
    """
    STATUS_CHOICES = [
        ('active', 'Đang học'),
        ('completed', 'Hoàn thành'),
        ('dropped', 'Đã nghỉ'),
        ('suspended', 'Tạm nghỉ'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Chưa thanh toán'),
        ('deposited', 'Đã đặt cọc'),
        ('paid', 'Đã thanh toán đủ'),
    ]

    APPROVAL_STATUS_CHOICES = [
        ('pending', 'Chờ duyệt'),
        ('approved', 'Đã duyệt'),
        ('rejected', 'Từ chối'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments', verbose_name='Học viên')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name='enrollments', verbose_name='Khóa học')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='enrollments', verbose_name='Lớp học')
    enrollment_date = models.DateField(auto_now_add=True, verbose_name='Ngày đăng ký')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='Trạng thái')

    # Đặt cọc & thanh toán
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Số tiền đặt cọc')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid', verbose_name='Trạng thái thanh toán')
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='pending', verbose_name='Trạng thái duyệt')

    notes = models.TextField(blank=True, null=True, verbose_name='Ghi chú')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'enrollments'
        verbose_name = 'Đăng ký'
        verbose_name_plural = 'Đăng ký'

    def __str__(self):
        return f"{self.student} - {self.classroom}"


class TestScore(models.Model):
    """Điểm Test đánh giá trình độ học viên
    
    - Không sử dụng điểm chuyên cần (attendance grade)
    - Chỉ dùng điểm Test: giữa kỳ, cuối kỳ, quiz, etc.
    - Điểm tổng kết = TB các bài Test (hoặc theo trọng số midterm/final)
    """
    TEST_TYPE_CHOICES = [
        ('midterm', 'Giữa kỳ'),
        ('final', 'Cuối kỳ'),
        ('quiz', 'Kiểm tra ngắn'),
        ('oral', 'Kiểm tra miệng'),
        ('practice', 'Bài tập thực hành'),
        ('other', 'Khác'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='test_scores', verbose_name='Học viên')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='test_scores', verbose_name='Lớp học')
    test_name = models.CharField(max_length=200, verbose_name='Tên bài Test')
    test_type = models.CharField(max_length=20, choices=TEST_TYPE_CHOICES, default='quiz', verbose_name='Loại bài Test')
    score = models.DecimalField(max_digits=5, decimal_places=2, verbose_name='Điểm')
    max_score = models.DecimalField(max_digits=5, decimal_places=2, default=10, verbose_name='Điểm tối đa')
    test_date = models.DateField(verbose_name='Ngày thi/kiểm tra')
    notes = models.TextField(blank=True, null=True, verbose_name='Ghi chú')
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, verbose_name='Người nhập')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'test_scores'
        verbose_name = 'Điểm Test'
        verbose_name_plural = 'Điểm Test'
        ordering = ['test_date']

    def __str__(self):
        return f"{self.student} - {self.test_name} - {self.score}/{self.max_score}"

    @property
    def score_10(self):
        """Quy đổi điểm về hệ 10"""
        if self.max_score and self.max_score > 0:
            return round(float(self.score) / float(self.max_score) * 10, 2)
        return 0
