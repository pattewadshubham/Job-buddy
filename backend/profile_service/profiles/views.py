from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from django.http import FileResponse, Http404
from django.core.files.storage import default_storage
from .models import SeekerProfile, RecruiterProfile, Skill, SeekerSkill, Experience, Resume
from .serializers import (
    SeekerProfileSerializer, RecruiterProfileSerializer,
    SkillSerializer, SeekerSkillSerializer, ExperienceSerializer, ResumeSerializer
)
from .utils import upload_to_s3, extract_text_from_pdf, get_presigned_url, publish_resume_uploaded, publish_resume_deleted


def get_seeker_profile(user_id):
    return SeekerProfile.objects.filter(user_id=user_id).first()


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "profile"})


class SeekerProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = SeekerProfile.objects.get(user_id=request.user.id)
            return Response(SeekerProfileSerializer(profile).data)
        except SeekerProfile.DoesNotExist:
            return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        if SeekerProfile.objects.filter(user_id=request.user.id).exists():
            return Response({"error": "Profile already exists."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = SeekerProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user_id=request.user.id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        try:
            profile = SeekerProfile.objects.get(user_id=request.user.id)
        except SeekerProfile.DoesNotExist:
            return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = SeekerProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class RecruiterProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = RecruiterProfile.objects.get(user_id=request.user.id)
            return Response(RecruiterProfileSerializer(profile).data)
        except RecruiterProfile.DoesNotExist:
            return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        if RecruiterProfile.objects.filter(user_id=request.user.id).exists():
            return Response({"error": "Profile already exists."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RecruiterProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user_id=request.user.id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        try:
            profile = RecruiterProfile.objects.get(user_id=request.user.id)
        except RecruiterProfile.DoesNotExist:
            return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = RecruiterProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SkillListView(APIView):
    def get(self, request):
        return Response(SkillSerializer(Skill.objects.all(), many=True).data)


class SeekerSkillView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        seeker = get_seeker_profile(request.user.id)
        if not seeker:
            return Response({"error": "Seeker profile not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SeekerSkillSerializer(seeker.skills.all(), many=True).data)

    def post(self, request):
        seeker = get_seeker_profile(request.user.id)
        if not seeker:
            return Response({"error": "Seeker profile not found."}, status=status.HTTP_404_NOT_FOUND)
        skill, _ = Skill.objects.get_or_create(name=request.data.get('skill_name', '').strip())
        obj, created = SeekerSkill.objects.get_or_create(
            seeker=seeker, skill=skill,
            defaults={'years_of_experience': request.data.get('years_of_experience', 0)}
        )
        return Response(SeekerSkillSerializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ExperienceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        seeker = get_seeker_profile(request.user.id)
        if not seeker:
            return Response({"error": "Seeker profile not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ExperienceSerializer(seeker.experiences.all(), many=True).data)

    def post(self, request):
        seeker = get_seeker_profile(request.user.id)
        if not seeker:
            return Response({"error": "Seeker profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ExperienceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(seeker=seeker)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ResumeUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def get(self, request):
        seeker = get_seeker_profile(request.user.id)
        if not seeker:
            return Response({"error": "Seeker profile not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ResumeSerializer(seeker.resumes.all(), many=True).data)

    def post(self, request):
        file = request.FILES.get('resume')
        if not file or not file.name.endswith('.pdf'):
            return Response({"error": "PDF file required."}, status=status.HTTP_400_BAD_REQUEST)

        seeker = get_seeker_profile(request.user.id)
        if not seeker:
            return Response({"error": "Seeker profile not found."}, status=status.HTTP_404_NOT_FOUND)

        raw_text = extract_text_from_pdf(file)
        file.seek(0)

        try:
            local_path = upload_to_s3(file, seeker.id)
            parsing_status = 'success'
        except Exception as e:
            return Response({"error": f"Upload failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        resume = Resume.objects.create(
            seeker=seeker,
            resume_title=request.data.get('resume_title', file.name),
            local_path=local_path,
            file_size_bytes=file.size,
            is_primary=not seeker.resumes.filter(is_primary=True).exists(),
            raw_text=raw_text,
            parsing_status=parsing_status if raw_text else 'failed',
        )

        publish_resume_uploaded(resume.id, seeker.user_id, raw_text)

        return Response(ResumeSerializer(resume).data, status=status.HTTP_201_CREATED)


class ResumeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, resume_id):
        seeker = get_seeker_profile(request.user.id)
        if not seeker:
            return Response({"error": "Seeker profile not found."}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            resume = seeker.resumes.get(id=resume_id)
        except Resume.DoesNotExist:
            return Response({"error": "Resume not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Publish event before deleting to ensure matching service can delete embeddings
        publish_resume_deleted(resume.id, seeker.user_id)
        
        # Optionally, delete the file from storage
        if default_storage.exists(resume.local_path):
            default_storage.delete(resume.local_path)
            
        resume.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, resume_id):
        seeker = get_seeker_profile(request.user.id)
        if not seeker:
            return Response({"error": "Seeker profile not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            resume = seeker.resumes.get(id=resume_id)
        except Resume.DoesNotExist:
            return Response({"error": "Resume not found."}, status=status.HTTP_404_NOT_FOUND)

        is_primary = request.data.get('is_primary')
        if is_primary is not None:
            if is_primary:
                # Set all other resumes to not primary
                seeker.resumes.exclude(id=resume.id).update(is_primary=False)
            resume.is_primary = is_primary
            resume.save()
            return Response(ResumeSerializer(resume).data)
        
        return Response({"error": "No valid data provided."}, status=status.HTTP_400_BAD_REQUEST)



class ResumeURLView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, resume_id):
        try:
            resume = Resume.objects.get(id=resume_id)
        except Resume.DoesNotExist:
            return Response({"error": "Resume not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Allow access if the user is the seeker OR a recruiter
        is_owner = str(resume.seeker.user_id) == str(request.user.id)
        is_recruiter = RecruiterProfile.objects.filter(user_id=request.user.id).exists()
        
        if not (is_owner or is_recruiter):
            return Response({"error": "Forbidden. You do not have permission to view this resume."}, status=status.HTTP_403_FORBIDDEN)
        
        url = get_presigned_url(resume.local_path)
        return Response({"url": url})


class ResumeDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, resume_id):
        try:
            resume = Resume.objects.get(id=resume_id)
        except Resume.DoesNotExist:
            raise Http404("Resume not found.")
        
        # Allow access if the user is the seeker OR a recruiter
        is_owner = str(resume.seeker.user_id) == str(request.user.id)
        is_recruiter = RecruiterProfile.objects.filter(user_id=request.user.id).exists()
        
        if not (is_owner or is_recruiter):
            return Response({"error": "Forbidden. You do not have permission to download this resume."}, status=status.HTTP_403_FORBIDDEN)
        
        if not default_storage.exists(resume.local_path):
            raise Http404("Resume file not found.")
        
        file = default_storage.open(resume.local_path, 'rb')
        response = FileResponse(file, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{resume.resume_title}"'
        return response

class SeekerProfileByIdView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, seeker_id):
        try:
            # Try to lookup by profile primary key first
            profile = SeekerProfile.objects.filter(id=seeker_id).first()
            if not profile:
                # If not found, try to lookup by user_id
                profile = SeekerProfile.objects.filter(user_id=seeker_id).first()
            
            if not profile:
                return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
                
            data = SeekerProfileSerializer(profile).data
            data['skills'] = SeekerSkillSerializer(profile.skills.all(), many=True).data
            data['experiences'] = ExperienceSerializer(profile.experiences.all(), many=True).data
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
