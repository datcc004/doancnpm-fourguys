"""
Permissions - Phân quyền truy cập
"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Chỉ admin mới được truy cập"""
    def has_permission(self, request, view):
        return request.user and request.user.role == 'admin'


class IsStaffOrAdmin(BasePermission):
    """Admin hoặc nhân viên"""
    def has_permission(self, request, view):
        return request.user and request.user.role in ['admin', 'staff']


class IsTeacher(BasePermission):
    """Chỉ giảng viên"""
    def has_permission(self, request, view):
        return request.user and request.user.role == 'teacher'


class IsStudent(BasePermission):
    """Chỉ học viên"""
    def has_permission(self, request, view):
        return request.user and request.user.role == 'student'


class IsOwnerOrAdmin(BasePermission):
    """Chỉ chủ sở hữu hoặc admin"""
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return obj == request.user
