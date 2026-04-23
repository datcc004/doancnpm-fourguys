"""Bộ lọc query cho API attendance."""
import django_filters

from .models import TeacherAttendance


class TeacherAttendanceFilter(django_filters.FilterSet):
    """Lọc chấm công GV: theo GV, trạng thái, ngày hoặc khoảng ngày."""

    work_date_after = django_filters.DateFilter(field_name='work_date', lookup_expr='gte')
    work_date_before = django_filters.DateFilter(field_name='work_date', lookup_expr='lte')

    class Meta:
        model = TeacherAttendance
        fields = ['teacher', 'status', 'work_date']
