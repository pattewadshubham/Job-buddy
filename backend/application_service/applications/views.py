from datetime import timedelta
import uuid
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Application, ApplicationStageHistory, Interview
from .serializers import (
    ApplicationSerializer,
    ApplicationStageHistorySerializer,
    InterviewScheduleSerializer,
    InterviewSerializer,
    StageUpdateSerializer,
)
from .utils import fetch_job_details, publish_application_stage_changed, publish_interview_scheduled, publish_application_received


def recruiter_owns_application(application, user):
    return request_user_is_recruiter(user) and str(application.recruiter_id) == str(user.id)


def request_user_is_seeker(user):
    return getattr(user, 'role', '') == 'seeker'


def request_user_is_recruiter(user):
    return getattr(user, 'role', '') == 'recruiter'


def user_can_access_application(user, application):
    if request_user_is_seeker(user):
        return str(application.seeker_id) == str(user.id)
    if request_user_is_recruiter(user):
        return recruiter_owns_application(application, user)
    return False


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'applications'})


class ApplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request_user_is_seeker(request.user):
            return Response({'error': 'Only seekers can apply.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        job_id = serializer.validated_data['job_id']
        seeker_id = request.user.id
        job_details = fetch_job_details(job_id)

        if not job_details:
            return Response({'error': 'Job not found.'}, status=status.HTTP_404_NOT_FOUND)
        if job_details.get('status') != 'published' or job_details.get('is_archived'):
            return Response({'error': 'This job is not accepting new applications.'}, status=status.HTTP_400_BAD_REQUEST)

        if Application.objects.filter(job_id=job_id, seeker_id=seeker_id).exists():
            return Response({'error': 'Already applied for this job.'}, status=status.HTTP_400_BAD_REQUEST)

        application = serializer.save(
            seeker_id=seeker_id,
            seeker_email=getattr(request.user, 'email', ''),
            recruiter_id=job_details.get('recruiter_id'),
            job_title=job_details.get('title', ''),
        )
        ApplicationStageHistory.objects.create(
            application=application,
            old_stage='',
            new_stage=application.current_stage,
            changed_by=seeker_id,
            note='Application submitted',
        )
        publish_application_received(
            application.id,
            application.recruiter_id,
            application.job_title,
            application.seeker_email,
        )
        return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)


class MyApplicationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        applications = Application.objects.filter(seeker_id=request.user.id).order_by('-created_at')
        return Response(ApplicationSerializer(applications, many=True).data)


class JobApplicationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        if not request_user_is_recruiter(request.user):
            return Response({'error': 'Only recruiters can view job applications.'}, status=status.HTTP_403_FORBIDDEN)

        applications = Application.objects.filter(
            job_id=job_id,
            recruiter_id=request.user.id,
            is_withdrawn=False,
        ).order_by('-created_at')
        return Response(ApplicationSerializer(applications, many=True).data)


class ApplicationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        application = get_object_or_404(Application, id=application_id)
        if not user_can_access_application(request.user, application):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(ApplicationSerializer(application).data)


class WithdrawApplicationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        application = get_object_or_404(Application, id=application_id, seeker_id=request.user.id)
        application.is_withdrawn = True
        application.save(update_fields=['is_withdrawn', 'updated_at'])
        return Response({'message': 'Application withdrawn.'})


class UpdateStageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        if not request_user_is_recruiter(request.user):
            return Response({'error': 'Only recruiters can update stage.'}, status=status.HTTP_403_FORBIDDEN)

        application = get_object_or_404(Application, id=application_id)
        if not recruiter_owns_application(application, request.user):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = StageUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_stage = serializer.validated_data['new_stage']
        note = serializer.validated_data.get('note', '')

        old_stage = application.current_stage
        application.current_stage = new_stage
        application.save(update_fields=['current_stage', 'updated_at'])

        history = ApplicationStageHistory.objects.create(
            application=application,
            old_stage=old_stage,
            new_stage=new_stage,
            changed_by=request.user.id,
            note=note,
        )

        publish_application_stage_changed(application.id, application.seeker_id, new_stage)

        return Response({
            'application': ApplicationSerializer(application).data,
            'history': ApplicationStageHistorySerializer(history).data,
        })


class StageHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        application = get_object_or_404(Application, id=application_id)
        if not user_can_access_application(request.user, application):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        history = application.stage_history.order_by('-changed_at')
        return Response(ApplicationStageHistorySerializer(history, many=True).data)


class ScheduleInterviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        if not request_user_is_recruiter(request.user):
            return Response({'error': 'Only recruiters can schedule interviews.'}, status=status.HTTP_403_FORBIDDEN)

        application = get_object_or_404(Application, id=application_id)
        if not recruiter_owns_application(application, request.user):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = InterviewScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        scheduled_at = serializer.validated_data['scheduled_at']
        recruiter_notes = serializer.validated_data.get('recruiter_notes', '')

        room_id = f"jobportal-{uuid.uuid4()}"
        link = f"https://meet.jit.si/{room_id}"
        expires_at = scheduled_at + timedelta(hours=2)

        interview, _ = Interview.objects.update_or_create(
            application=application,
            defaults={
                'scheduled_at': scheduled_at,
                'expires_at': expires_at,
                'jitsi_room_id': room_id,
                'jitsi_link': link,
                'recruiter_notes': recruiter_notes,
                'is_expired': expires_at <= timezone.now(),
            },
        )

        old_stage = application.current_stage
        application.current_stage = Application.STAGE_INTERVIEW
        application.save(update_fields=['current_stage', 'updated_at'])

        ApplicationStageHistory.objects.create(
            application=application,
            old_stage=old_stage,
            new_stage=Application.STAGE_INTERVIEW,
            changed_by=request.user.id,
            note='Interview scheduled',
        )

        publish_application_stage_changed(application.id, application.seeker_id, Application.STAGE_INTERVIEW)
        publish_interview_scheduled(
            application.id,
            application.seeker_id,
            scheduled_at,
            link,
            application.seeker_email,
            application.job_title,
        )

        return Response(InterviewSerializer(interview).data, status=status.HTTP_201_CREATED)


class InterviewDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        application = get_object_or_404(Application, id=application_id)
        interview = get_object_or_404(Interview, application=application)

        if not user_can_access_application(request.user, application):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(InterviewSerializer(interview).data)
