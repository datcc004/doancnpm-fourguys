"""
Serializers - Payments API
"""
from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer cho Payment"""
    student_name = serializers.SerializerMethodField()
    classroom_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ['id', 'student', 'student_name', 'enrollment', 'classroom_name',
                  'amount', 'discount', 'final_amount', 'payment_method',
                  'status', 'payment_date', 'due_date', 'transaction_id',
                  'notes', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()

    def get_classroom_name(self, obj):
        if obj.enrollment:
            return obj.enrollment.classroom.name
        return None
