import uuid
from django.db import models
from pgvector.django import VectorField


class ResumeEmbedding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resume_id = models.UUIDField(unique=True)
    seeker_id = models.UUIDField(db_index=True)
    embedding = VectorField(dimensions=384)
    model_version = models.CharField(max_length=50, default='all-MiniLM-L6-v2')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'resume_embeddings'
        app_label = 'matching'


class JobEmbedding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_id = models.UUIDField(unique=True)
    embedding = VectorField(dimensions=384)
    model_version = models.CharField(max_length=50, default='all-MiniLM-L6-v2')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'job_embeddings'
        app_label = 'matching'
