"""
Models - Quản lý học phí
"""
from django.db import models
from apps.accounts.models import Student
from apps.courses.models import Enrollment


class Payment(models.Model):
    """Thanh toán học phí"""
    STATUS_CHOICES = [
        ('pending', 'Chờ thanh toán'),
        ('paid', 'Đã thanh toán'),
        ('overdue', 'Quá hạn'),
        ('refunded', 'Đã hoàn tiền'),
        ('cancelled', 'Đã hủy'),
    ]

    METHOD_CHOICES = [
        ('cash', 'Tiền mặt'),
        ('transfer', 'Chuyển khoản'),
        ('card', 'Thẻ'),
        ('other', 'Khác'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payments', verbose_name='Học viên')
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='payments',
                                   verbose_name='Đăng ký lớp', null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Số tiền')
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Giảm giá')
    final_amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Thành tiền')
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash', verbose_name='Phương thức')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='Trạng thái')
    payment_date = models.DateTimeField(blank=True, null=True, verbose_name='Ngày thanh toán')
    due_date = models.DateField(blank=True, null=True, verbose_name='Hạn thanh toán')
    transaction_id = models.CharField(max_length=100, blank=True, null=True, verbose_name='Mã giao dịch')
    notes = models.TextField(blank=True, null=True, verbose_name='Ghi chú')
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True,
                                   related_name='created_payments', verbose_name='Người tạo')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        verbose_name = 'Thanh toán'
        verbose_name_plural = 'Thanh toán'
        ordering = ['-created_at']

    def __str__(self):
        return f"#{self.id} - {self.student} - {self.final_amount}"

    def save(self, *args, **kwargs):
        # Tự tính thành tiền
        if not self.final_amount:
            self.final_amount = self.amount - self.discount
        super().save(*args, **kwargs)
