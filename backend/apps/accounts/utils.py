from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def send_automated_email(subject, message, recipient_list, html_message=None):
    """
    Hàm gửi email tự động dùng chung cho toàn hệ thống.
    """
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Email sent successfully to {recipient_list}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_list}: {str(e)}")
        return False


# ============================================================
# Các hàm gửi Email chuyên biệt cho từng nghiệp vụ
# ============================================================

def send_enrollment_email(student, classroom, payment):
    """Gửi email xác nhận đăng ký khóa học"""
    subject = f"[FourGuys] Xác nhận đăng ký lớp học {classroom.code}"
    message = (
        f"Chào {student.user.first_name},\n\n"
        f"Bạn đã đăng ký thành công lớp học {classroom.name} ({classroom.code}).\n"
        f"Khóa học: {classroom.course.name}\n"
        f"Lịch học: {classroom.schedule or 'Sẽ cập nhật sau'}\n"
        f"Học phí: {payment.final_amount:,.0f} VNĐ\n"
        f"Hạn thanh toán: {payment.due_date}\n\n"
        f"Vui lòng hoàn tất học phí trước ngày khai giảng.\n"
        f"Trân trọng,\nĐội ngũ FourGuys."
    )
    return send_automated_email(subject, message, [student.user.email])


def send_attendance_email(student, classroom, session_date, status_display, session_number=None):
    """Gửi email thông báo điểm danh vắng hoặc đi trễ"""
    buoi = f" (Buổi {session_number})" if session_number else ""
    subject = f"[FourGuys] Thông báo điểm danh - Lớp {classroom.code}"
    message = (
        f"Chào {student.user.first_name},\n\n"
        f"Hệ thống ghi nhận bạn đã {status_display} "
        f"trong buổi học ngày {session_date}{buoi}.\n\n"
        f"Lớp: {classroom.name} ({classroom.code})\n"
        f"Khóa học: {classroom.course.name}\n\n"
        f"Nếu có nhầm lẫn, vui lòng liên hệ giảng viên hoặc quản trị viên.\n"
        f"Trân trọng,\nĐội ngũ FourGuys."
    )
    return send_automated_email(subject, message, [student.user.email])


def send_grade_email(student, classroom, enrollment):
    """Gửi email thông báo khi có điểm mới"""
    subject = f"[FourGuys] Cập nhật điểm số - Lớp {classroom.code}"

    # Lấy các điểm đã có
    grades_info = []
    if enrollment.attendance_grade is not None:
        grades_info.append(f"  - Điểm chuyên cần (10%): {enrollment.attendance_grade}")
    if enrollment.midterm_grade is not None:
        grades_info.append(f"  - Điểm giữa kỳ (20%): {enrollment.midterm_grade}")
    if enrollment.final_test_grade is not None:
        grades_info.append(f"  - Điểm cuối kỳ (70%): {enrollment.final_test_grade}")

    grades_text = "\n".join(grades_info) if grades_info else "  Chưa có điểm nào."

    # Tổng kết nếu đủ điểm
    final_text = ""
    if enrollment.final_grade is not None:
        final_text = (
            f"\n📊 Điểm tổng kết: {enrollment.final_grade}/10 "
            f"({enrollment.letter_grade})\n"
        )

    message = (
        f"Chào {student.user.first_name},\n\n"
        f"Điểm số của bạn tại lớp {classroom.name} ({classroom.code}) "
        f"vừa được cập nhật:\n\n"
        f"{grades_text}\n"
        f"{final_text}\n"
        f"Trân trọng,\nĐội ngũ FourGuys."
    )
    return send_automated_email(subject, message, [student.user.email])
