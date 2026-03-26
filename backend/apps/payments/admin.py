from django.contrib import admin
from .models import Payment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'student', 'final_amount', 'payment_method', 'status', 'payment_date']
    list_filter = ['status', 'payment_method']
    search_fields = ['student__user__first_name', 'transaction_id']
