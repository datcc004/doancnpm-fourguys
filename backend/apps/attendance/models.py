"""
Models - Điểm danh học viên
"""
from django.db import models
from apps.accounts.models import Student
from apps.courses.models import ClassRoom


class AttendanceSession(models.Model):
    """Buổi điểm danh"""
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE,
                                  related_name='attendance_sessions', verbose_name='Lớp học')
    session_date = models.DateField(verbose_name='Ngày học')
    session_number = models.IntegerField(default=1, verbose_name='Buổi thứ')
    topic = models.CharField(max_length=200, blank=True, null=True, verbose_name='Nội dung buổi học')
    notes = models.TextField(blank=True, null=True, verbose_name='Ghi chú')
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True,
                                   verbose_name='Người tạo')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_sessions'
        verbose_name = 'Buổi điểm danh'
        verbose_name_plural = 'Buổi điểm danh'
        unique_together = ['classroom', 'session_date', 'session_number']
        ordering = ['-session_date']

    def __str__(self):
        return f"{self.classroom.name} - {self.session_date}"


class AttendanceRecord(models.Model):
    """Chi tiết điểm danh từng học viên"""
    STATUS_CHOICES = [
        ('present', 'Có mặt'),
        ('absent', 'Vắng'),
        ('late', 'Đi trễ'),
        ('excused', 'Có phép'),
    ]

    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE,
                                related_name='records', verbose_name='Buổi học')
    student = models.ForeignKey(Student, on_delete=models.CASCADE,
                                related_name='attendance_records', verbose_name='Học viên')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='present',
                              verbose_name='Trạng thái')
    notes = models.CharField(max_length=200, blank=True, null=True, verbose_name='Ghi chú')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance'
        verbose_name = 'Điểm danh'
        verbose_name_plural = 'Điểm danh'
        unique_together = ['session', 'student']

    def __str__(self):
        return f"{self.student} - {self.session} - {self.get_status_display()}"
