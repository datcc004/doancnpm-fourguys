"""
Views - API endpoints cho payments
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .models import Payment
from .serializers import PaymentSerializer
from apps.accounts.permissions import IsStaffOrAdmin


class PaymentViewSet(viewsets.ModelViewSet):
    """CRUD cho Payment"""
    serializer_class = PaymentSerializer
    search_fields = ['student__user__first_name', 'student__user__last_name', 'transaction_id']
    filterset_fields = ['status', 'payment_method', 'student']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'mark_paid']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsStaffOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        queryset = Payment.objects.select_related('student__user', 'enrollment__classroom').all()
        
        if getattr(user, 'role', '') == 'student':
            if hasattr(user, 'student_profile'):
                return queryset.filter(student=user.student_profile)
            return queryset.none()
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Đánh dấu đã thanh toán (Cập nhật trực tiếp không cần xác nhận)"""
        payment = self.get_object()
        payment.status = 'paid'
        payment.payment_date = timezone.now()
        payment.save()
        return Response(PaymentSerializer(payment).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Tóm tắt thanh toán"""
        from django.db.models import Sum, Count
        data = {
            'total_paid': float(Payment.objects.filter(status='paid').aggregate(t=Sum('final_amount'))['t'] or 0),
            'total_pending': float(Payment.objects.filter(status='pending').aggregate(t=Sum('final_amount'))['t'] or 0),
            'total_overdue': float(Payment.objects.filter(status='overdue').aggregate(t=Sum('final_amount'))['t'] or 0),
            'count_paid': Payment.objects.filter(status='paid').count(),
            'count_pending': Payment.objects.filter(status='pending').count(),
            'count_overdue': Payment.objects.filter(status='overdue').count(),
        }
        return Response(data)
