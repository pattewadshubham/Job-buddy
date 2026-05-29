from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from pgvector.django import CosineDistance

from .models import JobEmbedding, ResumeEmbedding
from .utils import generate_embedding


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'matching'})


class UpsertResumeEmbeddingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        resume_id = request.data.get('resume_id')
        seeker_id = request.data.get('seeker_id')
        raw_text = request.data.get('raw_text', '')

        if not resume_id or not seeker_id:
            return Response({'error': 'resume_id and seeker_id are required.'}, status=400)

        vector = generate_embedding(raw_text)
        emb, _ = ResumeEmbedding.objects.update_or_create(
            resume_id=resume_id,
            defaults={
                'seeker_id': seeker_id,
                'embedding': vector,
            },
        )
        return Response({'message': 'Resume embedding saved.', 'id': str(emb.id)})


class UpsertJobEmbeddingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        job_id = request.data.get('job_id')
        description_text = request.data.get('description_text', '')

        if not job_id:
            return Response({'error': 'job_id is required.'}, status=400)

        vector = generate_embedding(description_text)
        emb, _ = JobEmbedding.objects.update_or_create(
            job_id=job_id,
            defaults={'embedding': vector},
        )
        return Response({'message': 'Job embedding saved.', 'id': str(emb.id)})


class JobsForSeekerView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, seeker_id):
        resume_id = request.query_params.get('resume_id')
        if resume_id:
            resume = ResumeEmbedding.objects.filter(seeker_id=seeker_id, resume_id=resume_id).first()
            if not resume:
                # Fallback if specific resume embedding not found
                resume = ResumeEmbedding.objects.filter(seeker_id=seeker_id).order_by('-updated_at').first()
        else:
            resume = ResumeEmbedding.objects.filter(seeker_id=seeker_id).order_by('-updated_at').first()
            
        if not resume:
            return Response({'results': []})

        seeker_vec = resume.embedding
        # Use pgvector CosineDistance for efficient DB-level search
        matches = JobEmbedding.objects.annotate(
            distance=CosineDistance('embedding', seeker_vec)
        ).order_by('distance')[:10]

        results = [
            {'job_id': str(m.job_id), 'similarity_score': round(1 - float(m.distance), 4)}
            for m in matches
        ]
        return Response({'results': results})


class SeekersForJobView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        try:
            job = JobEmbedding.objects.get(job_id=job_id)
        except JobEmbedding.DoesNotExist:
            return Response({'results': []})

        job_vec = job.embedding
        # Use pgvector CosineDistance for efficient DB-level search
        matches = ResumeEmbedding.objects.annotate(
            distance=CosineDistance('embedding', job_vec)
        ).order_by('distance')[:10]

        results = [
            {
                'seeker_id': str(m.seeker_id),
                'resume_id': str(m.resume_id),
                'similarity_score': round(1 - float(m.distance), 4),
            }
            for m in matches
        ]
        return Response({'results': results})
