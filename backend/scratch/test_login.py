import os
import django
import sys

# Setup Django
sys.path.append(r'c:\Users\This PC\Desktop\doancnpm\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'language_center.settings')
django.setup()

from apps.accounts.models import User
from apps.accounts.authentication import generate_token
from rest_framework.test import APIClient

client = APIClient()
try:
    admin = User.objects.get(username='admin')
    print(f"Admin found: {admin.id}")
    # Verify authentication logic
    from django.contrib.auth import authenticate
    user = authenticate(username='admin', password='password')
    print(f"Authenticate check: {user is not None}")
    
    token = generate_token(admin)
    print(f"Token generation: OK")
except Exception as e:
    print(f"Error: {e}")
