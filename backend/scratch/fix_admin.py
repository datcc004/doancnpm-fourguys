import os
import django
import sys

# Setup Django
sys.path.append(r'c:\Users\This PC\Desktop\doancnpm\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'language_center.settings')
django.setup()

from apps.accounts.models import User

# Reset 'admin' password
try:
    u = User.objects.filter(role='admin').first()
    if u:
        u.set_password('password')
        u.save()
        print(f"SUCCESS: Reset password for {u.username} to 'password'")
    else:
        # Create one if missing
        User.objects.create_superuser('admin', 'admin@example.com', 'password', role='admin')
        print("SUCCESS: Created superuser 'admin' with password 'password'")
except Exception as e:
    print(f"ERROR: {e}")
