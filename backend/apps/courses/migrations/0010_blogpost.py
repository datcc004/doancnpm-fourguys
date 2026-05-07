from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


def seed_blog_posts(apps, schema_editor):
    BlogPost = apps.get_model('courses', 'BlogPost')
    if BlogPost.objects.exists():
        return
    now = timezone.now()
    BlogPost.objects.bulk_create([
        BlogPost(
            title='Vì sao học ngoại ngữ là kỹ năng bắt buộc trong thời đại số?',
            slug='vi-sao-hoc-ngoai-ngu-la-ky-nang-bat-buoc',
            excerpt='Ngoại ngữ không chỉ phục vụ giao tiếp mà còn mở rộng cơ hội nghề nghiệp và tư duy toàn cầu.',
            content='Học ngoại ngữ giúp bạn tiếp cận tri thức mới, tăng khả năng thích nghi và tự tin khi làm việc trong môi trường đa văn hóa.',
            cover_image_url='https://images.unsplash.com/photo-1455390582262-044cdead277a',
            is_published=True,
            published_at=now,
        ),
        BlogPost(
            title='Lộ trình 90 ngày cải thiện phản xạ giao tiếp hiệu quả',
            slug='lo-trinh-90-ngay-cai-thien-phan-xa-giao-tiep',
            excerpt='Phương pháp học theo mục tiêu tuần giúp bạn duy trì kỷ luật và nhìn thấy tiến bộ rõ ràng.',
            content='Bắt đầu từ phát âm và vốn từ cốt lõi, sau đó tăng dần cường độ nghe nói qua tình huống thực tế để tạo phản xạ tự nhiên.',
            cover_image_url='https://images.unsplash.com/photo-1523240795612-9a054b0db644',
            is_published=True,
            published_at=now,
        ),
        BlogPost(
            title='Bí quyết giữ động lực học ngoại ngữ dài hạn',
            slug='bi-quyet-giu-dong-luc-hoc-ngoai-ngu-dai-han',
            excerpt='Động lực không đến từ cảm hứng nhất thời, mà từ hệ thống học tập và cộng đồng đồng hành.',
            content='Thiết lập mục tiêu nhỏ, theo dõi tiến độ mỗi tuần và tham gia môi trường học tập tích cực là chìa khóa để học bền vững.',
            cover_image_url='https://images.unsplash.com/photo-1434030216411-0b793f4b4173',
            is_published=True,
            published_at=now,
        ),
    ])


def unseed_blog_posts(apps, schema_editor):
    BlogPost = apps.get_model('courses', 'BlogPost')
    BlogPost.objects.filter(
        slug__in=[
            'vi-sao-hoc-ngoai-ngu-la-ky-nang-bat-buoc',
            'lo-trinh-90-ngay-cai-thien-phan-xa-giao-tiep',
            'bi-quyet-giu-dong-luc-hoc-ngoai-ngu-dai-han',
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('courses', '0009_alter_enrollment_unique_together_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='BlogPost',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255, verbose_name='Tiêu đề')),
                ('slug', models.SlugField(max_length=255, unique=True, verbose_name='Slug')),
                ('excerpt', models.CharField(blank=True, max_length=400, null=True, verbose_name='Tóm tắt')),
                ('content', models.TextField(verbose_name='Nội dung')),
                ('cover_image_url', models.URLField(blank=True, max_length=500, null=True, verbose_name='Ảnh bìa (URL)')),
                ('is_published', models.BooleanField(default=True, verbose_name='Công khai')),
                ('published_at', models.DateTimeField(blank=True, null=True, verbose_name='Ngày xuất bản')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='Người tạo')),
            ],
            options={
                'verbose_name': 'Bài viết',
                'verbose_name_plural': 'Bài viết',
                'db_table': 'blog_posts',
                'ordering': ['-published_at', '-created_at'],
            },
        ),
        migrations.RunPython(seed_blog_posts, reverse_code=unseed_blog_posts),
    ]
