from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


def seed_scholarships(apps, schema_editor):
    Scholarship = apps.get_model('courses', 'Scholarship')
    if Scholarship.objects.exists():
        return

    today = timezone.localdate()
    Scholarship.objects.bulk_create([
        Scholarship(
            title='Học bổng Tân học viên 2026',
            slug='hoc-bong-tan-hoc-vien-2026',
            short_description='Hỗ trợ học phí cho học viên đăng ký khóa mới trong năm 2026.',
            content='Dành cho học viên mới đăng ký lần đầu tại FourGuys với kết quả test đầu vào đạt yêu cầu.',
            amount_text='Tối đa 30% học phí',
            eligibility='Áp dụng cho học viên mới, hoàn tất hồ sơ và học phí đợt 1 đúng hạn.',
            deadline=today,
            image_url='https://images.unsplash.com/photo-1521587760476-6c12a4b040da',
            is_published=True,
            published_at=timezone.now(),
        ),
        Scholarship(
            title='Học bổng Đồng hành cùng học viên xuất sắc',
            slug='hoc-bong-dong-hanh-cung-hoc-vien-xuat-sac',
            short_description='Khuyến khích học viên có thành tích nổi bật và tinh thần học tập tốt.',
            content='Trao cho học viên có điểm tổng kết cao và tham gia tích cực các hoạt động học thuật.',
            amount_text='5.000.000 VNĐ',
            eligibility='Điểm trung bình >= 8.5 và không vi phạm nội quy lớp học.',
            deadline=None,
            image_url='https://images.unsplash.com/photo-1450101499163-c8848c66ca85',
            is_published=True,
            published_at=timezone.now(),
        ),
    ])


def unseed_scholarships(apps, schema_editor):
    Scholarship = apps.get_model('courses', 'Scholarship')
    Scholarship.objects.filter(
        slug__in=[
            'hoc-bong-tan-hoc-vien-2026',
            'hoc-bong-dong-hanh-cung-hoc-vien-xuat-sac',
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('courses', '0010_blogpost'),
    ]

    operations = [
        migrations.CreateModel(
            name='Scholarship',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255, verbose_name='Tên học bổng')),
                ('slug', models.SlugField(max_length=255, unique=True, verbose_name='Slug')),
                ('short_description', models.CharField(blank=True, max_length=400, null=True, verbose_name='Mô tả ngắn')),
                ('content', models.TextField(verbose_name='Nội dung chi tiết')),
                ('amount_text', models.CharField(blank=True, max_length=120, null=True, verbose_name='Giá trị học bổng')),
                ('eligibility', models.TextField(blank=True, null=True, verbose_name='Điều kiện áp dụng')),
                ('deadline', models.DateField(blank=True, null=True, verbose_name='Hạn nộp hồ sơ')),
                ('image_url', models.URLField(blank=True, max_length=500, null=True, verbose_name='Ảnh minh họa (URL)')),
                ('is_published', models.BooleanField(default=True, verbose_name='Công khai')),
                ('published_at', models.DateTimeField(blank=True, null=True, verbose_name='Ngày xuất bản')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='Người tạo')),
            ],
            options={
                'verbose_name': 'Học bổng',
                'verbose_name_plural': 'Học bổng',
                'db_table': 'scholarships',
                'ordering': ['deadline', '-published_at', '-created_at'],
            },
        ),
        migrations.RunPython(seed_scholarships, reverse_code=unseed_scholarships),
    ]
