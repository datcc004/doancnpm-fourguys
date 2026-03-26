"""
JWT Authentication - Xác thực bằng JSON Web Token
"""
import jwt
import datetime
from django.conf import settings
from rest_framework import authentication, exceptions
from .models import User


class JWTAuthentication(authentication.BaseAuthentication):
    """Xác thực người dùng bằng JWT token"""

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        try:
            # Lấy token từ header "Bearer <token>"
            prefix, token = auth_header.split(' ')
            if prefix.lower() != 'bearer':
                return None
        except ValueError:
            return None

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Token đã hết hạn')
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed('Token không hợp lệ')

        try:
            user = User.objects.get(id=payload['user_id'])
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('Người dùng không tồn tại')

        return (user, token)


def generate_token(user):
    """Tạo JWT token cho user"""
    payload = {
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        'iat': datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
