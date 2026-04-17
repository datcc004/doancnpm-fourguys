# Generated manually for TeacherAttendance model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts', '0001_initial'),
        ('attendance', '0002_remove_attendancerecord_notes_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='TeacherAttendance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('work_date', models.DateField(verbose_name='Ngày làm việc')),
                ('check_in', models.DateTimeField(blank=True, null=True, verbose_name='Giờ vào')),
                ('check_out', models.DateTimeField(blank=True, null=True, verbose_name='Giờ ra')),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('present', 'Đúng giờ'),
                            ('late', 'Đi muộn'),
                            ('absent', 'Vắng'),
                            ('leave', 'Nghỉ có phép'),
                            ('leave_unpaid', 'Nghỉ không phép'),
                        ],
                        default='present',
                        max_length=20,
                        verbose_name='Trạng thái',
                    ),
                ),
                ('absence_reason', models.CharField(blank=True, max_length=500, null=True, verbose_name='Lý do (vắng/nghỉ)')),
                ('notes', models.TextField(blank=True, null=True, verbose_name='Ghi chú')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'recorded_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='recorded_teacher_attendances',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Người ghi nhận',
                    ),
                ),
                (
                    'teacher',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='teacher_attendances',
                        to='accounts.teacher',
                        verbose_name='Giảng viên',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Chấm công giảng viên',
                'verbose_name_plural': 'Chấm công giảng viên',
                'db_table': 'teacher_attendance',
                'ordering': ['-work_date', 'teacher'],
                'unique_together': (('teacher', 'work_date'),),
            },
        ),
    ]
