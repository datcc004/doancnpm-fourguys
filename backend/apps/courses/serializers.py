"""
Serializers - Chuyển đổi dữ liệu cho API courses
"""
from rest_framework import serializers
from .models import Course, ClassRoom, Enrollment, TestScore, CourseMaterial
from apps.accounts.serializers import StudentSerializer, TeacherSerializer


class CourseSerializer(serializers.ModelSerializer):
    """Serializer cho Course"""
    total_classes = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    is_studying = serializers.SerializerMethodField()
    classrooms = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ['id', 'name', 'code', 'language', 'level', 'description',
                  'total_lessons', 'tuition_fee', 'max_students',
                  'is_active', 'total_classes', 'total_students', 'is_enrolled', 'is_studying', 'classrooms', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_classrooms(self, obj):
        # ClassRoomSerializer được định nghĩa ở dưới, nhưng python resolve name lúc runtime nên vẫn gọi được
        return ClassRoomSerializer(obj.classrooms.all(), many=True, context=self.context).data

    def validate_code(self, value):
        """Kiểm tra mã khóa học: hoa, không trùng"""
        import re
        value = value.upper()
        
        # Nếu đang sửa và mã không thay đổi → bỏ qua kiểm tra format
        if self.instance and self.instance.code == value:
            return value
        
        # Cho phép format linh hoạt: chữ, số, dấu gạch ngang
        if not re.match(r'^[A-Z0-9][A-Z0-9\-]{1,19}$', value):
            raise serializers.ValidationError("Mã khóa học không hợp lệ (chỉ dùng chữ IN HOA, số và dấu gạch ngang).")
        
        if Course.objects.filter(code=value).exists():
            raise serializers.ValidationError("Mã khóa học này đã tồn tại.")
        return value

    def validate_tuition_fee(self, value):
        """Học phí không được âm và phải lớn hơn 0"""
        if value < 0:
            raise serializers.ValidationError("Học phí không thể là số âm.")
        if value == 0:
            raise serializers.ValidationError("Học phí phải lớn hơn 0.")
        return value

    def validate_duration_weeks(self, value):
        """Thời lượng từ 1 đến 52 tuần"""
        if value < 1 or value > 52:
            raise serializers.ValidationError("Thời lượng khóa học phải từ 1 đến 52 tuần.")
        return value

    def validate_max_students(self, value):
        """Số lượng học viên từ 1 đến 100"""
        if value < 1 or value > 100:
            raise serializers.ValidationError("Sĩ số tối đa từ 1 đến 100 học viên.")
        return value

    def get_total_classes(self, obj):
        return obj.classrooms.count()

    def get_total_students(self, obj):
        return Enrollment.objects.filter(course=obj, status='active').count()

    def get_is_enrolled(self, obj):
        """Kiểm tra xem học viên hiện tại đã đăng ký khóa này chưa (bao gồm cả việc đã được xếp lớp)"""
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'student':
            if hasattr(request.user, 'student_profile'):
                from django.db.models import Q
                return Enrollment.objects.filter(
                    student=request.user.student_profile
                ).filter(
                    Q(course=obj) | Q(classroom__course=obj)
                ).exists()
        return False

    def get_is_studying(self, obj):
        """Kiểm tra xem học viên này đã chính thức có lớp trong khóa học hay chưa"""
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'student':
            if hasattr(request.user, 'student_profile'):
                from django.db.models import Q
                return Enrollment.objects.filter(
                    student=request.user.student_profile,
                    classroom__isnull=False
                ).filter(
                    Q(course=obj) | Q(classroom__course=obj)
                ).exists()
        return False


class ClassRoomSerializer(serializers.ModelSerializer):
    """Serializer cho ClassRoom"""
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_tuition_fee = serializers.IntegerField(source='course.tuition_fee', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    current_students = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = ClassRoom
        fields = ['id', 'name', 'code', 'course', 'course_name', 'course_tuition_fee', 'teacher', 'teacher_name',
                  'room', 'schedule', 'total_lessons', 'learning_mode', 'start_date', 'end_date', 'start_time', 'end_time',
                  'status', 'max_students', 'current_students', 'is_full', 'is_enrolled', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_is_enrolled(self, obj):
        """Kiểm tra xem user hiện tại (nếu là học viên) đã đăng ký lớp này chưa"""
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'student':
            if hasattr(request.user, 'student_profile'):
                return Enrollment.objects.filter(student=request.user.student_profile, classroom=obj).exists()
        return False

    def validate(self, data):
        """
        Kiểm tra logic nghiệp vụ cho lớp học:
        1. Ngày bắt đầu/kết thúc.
        2. Chuyên môn giảng viên (Teacher Qualification).
        3. Trùng lịch giảng viên (Teacher Schedule Conflict).
        """
        from .services import CourseService
        from apps.accounts.models import Teacher
        
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        teacher = data.get('teacher')
        course = data.get('course')
        schedule = data.get('schedule')
        
        # Lấy instance hiện tại nếu đang update
        instance = self.instance
        
        # 1. Kiểm tra ngày
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({"end_date": "Ngày bắt đầu không thể sau ngày kết thúc."})

        if teacher and course:
            # 2. Kiểm tra chuyên môn giảng viên (Teacher Qualification)
            course_lang_display = dict(course.LANGUAGE_CHOICES).get(course.language, '').lower()
            teacher_langs = (teacher.languages or '').lower()
            teacher_spec = (teacher.specialization or '').lower()
            
            # Logic: Kiểm tra trong field 'languages' trước, sau đó mới đến 'specialization'
            is_qualified = False
            
            # Kiểm tra trong languages (chính thức)
            if course_lang_display in teacher_langs or course.language in teacher_langs:
                is_qualified = True
            
            # Nếu chưa thấy, kiểm tra trong specialization (dự phòng)
            if not is_qualified:
                english_keywords = ['ielts', 'toeic', 'communication', 'anh', 'english']
                is_english_course = course.language == 'english' or 'anh' in course_lang_display
                
                if course_lang_display in teacher_spec or course.language in teacher_spec:
                    is_qualified = True
                elif is_english_course and any(kw in teacher_spec for kw in english_keywords):
                    is_qualified = True
                elif 'tất cả' in teacher_spec or 'tất cả' in teacher_langs:
                    is_qualified = True
                elif not teacher_spec and not teacher_langs:
                    is_qualified = True # Fallback cho GV mới chưa cập nhật hồ sơ
                
            if not is_qualified:
                raise serializers.ValidationError({
                    "teacher": f"Giảng viên {teacher.user.get_full_name()} không có chuyên môn hoặc ngôn ngữ phù hợp với lớp {course_lang_display}."
                })

            # 3. Kiểm tra trùng lịch giảng viên
            # Tạo một dummy ClassRoom object để so sánh nếu đang tạo mới
            from .models import ClassRoom
            temp_class = instance or ClassRoom(
                start_date=start_date, end_date=end_date, schedule=schedule
            )
            if not instance:
                temp_class.start_date = start_date
                temp_class.end_date = end_date
                temp_class.schedule = schedule

            if teacher:
                # Tìm các lớp khác mà GV này đang dạy (cùng thời gian)
                teacher_classes = ClassRoom.objects.filter(
                    teacher=teacher, 
                    status__in=['upcoming', 'active']
                )
                if instance:
                    teacher_classes = teacher_classes.exclude(id=instance.id)

                for other in teacher_classes:
                    if CourseService._check_schedule_conflict(temp_class, other):
                        raise serializers.ValidationError({
                            "teacher": f"Giảng viên này đã bị trùng lịch giảng dạy tại lớp '{other.code}' ({other.schedule})."
                        })

            # 4. Kiểm tra trùng phòng học
            room = data.get('room')
            if room:
                room_classes = ClassRoom.objects.filter(
                    room=room,
                    status__in=['upcoming', 'active']
                )
                if instance:
                    room_classes = room_classes.exclude(id=instance.id)

                for other in room_classes:
                    if CourseService._check_schedule_conflict(temp_class, other):
                        raise serializers.ValidationError({
                            "room": f"Phòng {room} đã bị trùng lịch sử dụng bởi lớp '{other.code}' ({other.schedule})."
                        })

        return data

    def validate_code(self, value):
        """Mã lớp phải là duy nhất"""
        value = value.upper()
        if ClassRoom.objects.filter(code=value).exists():
            if not self.instance or self.instance.code != value:
                raise serializers.ValidationError("Mã lớp học này đã tồn tại.")
        return value

    def get_teacher_name(self, obj):
        if obj.teacher:
            return obj.teacher.user.get_full_name()
        return None


class ClassRoomDetailSerializer(ClassRoomSerializer):
    """Serializer chi tiết ClassRoom (kèm danh sách học viên)"""
    course = CourseSerializer(read_only=True)
    teacher = TeacherSerializer(read_only=True)
    students = serializers.SerializerMethodField()

    class Meta:
        model = ClassRoom
        fields = ClassRoomSerializer.Meta.fields + ['students']

    def get_students(self, obj):
        enrollments = obj.enrollments.filter(status='active').select_related('student__user')
        return [
            {
                'enrollment_id': e.id,
                'student': StudentSerializer(e.student).data,
                'enrollment_date': e.enrollment_date,
                'status': e.status,
            }
            for e in enrollments
        ]


class EnrollmentSerializer(serializers.ModelSerializer):
    """Serializer cho Enrollment
    
    Nghiệp vụ: Đăng ký ghi danh → Nộp tiền (đặt cọc) → Admin duyệt
    """
    from apps.accounts.models import Student
    
    student = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), 
        required=False, 
        allow_null=True
    )
    student_name = serializers.SerializerMethodField()
    classroom_name = serializers.CharField(source='classroom.name', read_only=True, allow_null=True)
    classroom_code = serializers.CharField(source='classroom.code', read_only=True, allow_null=True)
    course_name = serializers.SerializerMethodField()
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    approval_status_display = serializers.CharField(source='get_approval_status_display', read_only=True)

    class Meta:
        model = Enrollment
        fields = ['id', 'student', 'student_name', 'course', 'course_name', 'classroom', 'classroom_name', 'classroom_code',
                  'enrollment_date', 'status',
                  'deposit_amount', 'payment_status', 'payment_status_display',
                  'approval_status', 'approval_status_display',
                  'notes']
        read_only_fields = ['id', 'enrollment_date']

    def validate(self, data):
        """Ngăn chặn đăng ký trùng khóa học và tự động gán student"""
        request = self.context.get('request')
        student = data.get('student')
        
        # Nếu đang update (PATCH) và không gửi student, lấy từ instance
        if not student and self.instance:
            student = self.instance.student
            
        # Nếu là học viên tự đăng ký -> Tự động lấy student từ profile
        if not student and request and getattr(request.user, 'role', '') == 'student':
            if hasattr(request.user, 'student_profile'):
                student = request.user.student_profile
                data['student'] = student
            else:
                raise serializers.ValidationError("Tài khoản của bạn chưa có thông tin hồ sơ học viên.")

        if not student and not self.instance:
            raise serializers.ValidationError({"student": "Vui lòng chọn học viên."})

        course = data.get('course', getattr(self.instance, 'course', None) if self.instance else None)
        classroom = data.get('classroom', getattr(self.instance, 'classroom', None) if self.instance else None)
        
        # Nếu đang tạo mới, kiểm tra trùng khóa học
        if not self.instance:
            if Enrollment.objects.filter(student=student, course=course).exists():
                raise serializers.ValidationError("Học viên này đã đăng ký khóa học này rồi.")
        
        # Nếu gán lớp, kiểm tra sĩ số lớp đó (trừ khi đang sửa chính bản ghi này)
        if classroom and 'classroom' in data: # Chỉ check sĩ số nếu classroom bị đổi hoặc set lần đầu
            if classroom.current_students >= classroom.max_students:
                # Nếu là update và bản ghi hiện tại ĐÃ thuộc lớp này thì không báo lỗi
                if self.instance and self.instance.classroom == classroom:
                    pass
                else:
                    raise serializers.ValidationError("Lớp học này đã đủ số lượng học viên.")

        # --- KIỂM TRA ĐẶT CỌC 30% HỌC PHÍ ---
        from decimal import Decimal
        course_obj = course
        if not course_obj and classroom:
            course_obj = classroom.course

        if course_obj:
            deposit_amount = data.get('deposit_amount')
            if deposit_amount is None:
                # Nếu đang update và không gửi tiền cọc, lấy từ db
                deposit_amount = getattr(self.instance, 'deposit_amount', 0)
                
            deposit_decimal = Decimal(str(deposit_amount) if deposit_amount else '0')
            required_deposit = course_obj.tuition_fee * Decimal('0.3')
            
            if deposit_decimal < required_deposit:
                raise serializers.ValidationError({
                    "deposit_amount": f"Phải cọc trước tối thiểu 30% học phí (tương đương {(required_deposit):,.0f} VNĐ) mới có thể đăng ký."
                })
                
            # Tư động cập nhật trạng thái thanh toán dựa theo số tiền cọc
            if deposit_decimal >= course_obj.tuition_fee:
                data['payment_status'] = 'paid'
            elif deposit_decimal >= required_deposit:
                data['payment_status'] = 'deposited'
        
        return data

    def get_course_name(self, obj):
        if obj.course:
            return obj.course.name
        if obj.classroom and obj.classroom.course:
            return obj.classroom.course.name
        return "-"

    def get_student_name(self, obj):
        user = obj.student.user
        if not user.last_name:
            return user.first_name
        return f"{user.last_name} {user.first_name}".strip()


class TestScoreSerializer(serializers.ModelSerializer):
    """Serializer cho TestScore"""
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source='student.student_code', read_only=True)
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    classroom_code = serializers.CharField(source='classroom.code', read_only=True)
    test_type_display = serializers.CharField(source='get_test_type_display', read_only=True)
    score_10 = serializers.ReadOnlyField()

    class Meta:
        model = TestScore
        fields = ['id', 'student', 'student_name', 'student_code',
                  'classroom', 'classroom_name', 'classroom_code',
                  'test_name', 'test_type', 'test_type_display',
                  'score', 'max_score', 'score_10', 'test_date',
                  'notes', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_student_name(self, obj):
        user = obj.student.user
        if not user.last_name:
            return user.first_name
        return f"{user.last_name} {user.first_name}".strip()


class BulkTestScoreSerializer(serializers.Serializer):
    """Serializer nhập điểm hàng loạt cho cả lớp"""
    classroom_id = serializers.IntegerField()
    test_name = serializers.CharField()
    test_type = serializers.CharField(default='quiz')
    test_date = serializers.DateField()
    max_score = serializers.DecimalField(max_digits=5, decimal_places=2, default=10)
    scores = serializers.ListField(
        child=serializers.DictField()
    )


class CourseMaterialSerializer(serializers.ModelSerializer):
    """Serializer cho CourseMaterial - Tài liệu bài giảng"""
    uploaded_by_name = serializers.SerializerMethodField()
    classroom_code = serializers.CharField(source='classroom.code', read_only=True)
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    file_url = serializers.SerializerMethodField()
    file_size_display = serializers.ReadOnlyField()
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)

    class Meta:
        model = CourseMaterial
        fields = ['id', 'classroom', 'classroom_code', 'classroom_name',
                  'title', 'description', 'file', 'file_url',
                  'file_type', 'file_type_display', 'file_size', 'file_size_display',
                  'original_filename', 'download_count',
                  'uploaded_by', 'uploaded_by_name',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'file_type', 'file_size', 'original_filename',
                            'download_count', 'uploaded_by', 'created_at', 'updated_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return '-'

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        elif obj.file:
            return obj.file.url
        return None
