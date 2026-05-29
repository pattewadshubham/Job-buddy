import os
import django
import sys

sys.path.append(os.path.abspath("."))
os.environ["DJANGO_SETTINGS_MODULE"] = "matching_service.settings"
django.setup()

from django.db import connection
from matching.models import JobEmbedding
from matching.utils import generate_embedding

def sync():
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, description FROM job_schema.jobs")
        jobs = cursor.fetchall()
        
    count = 0
    for job_id, description in jobs:
        if not JobEmbedding.objects.filter(job_id=job_id).exists():
            JobEmbedding.objects.create(
                job_id=job_id,
                embedding=generate_embedding(description)
            )
            count += 1
            
    # Also delete embeddings for jobs that no longer exist
    existing_job_ids = [str(j[0]) for j in jobs]
    deleted_count, _ = JobEmbedding.objects.exclude(job_id__in=existing_job_ids).delete()
    print(f"Deleted {deleted_count} stale embeddings.")
    
    print(f"Successfully synced {count} new embeddings. Total: {JobEmbedding.objects.count()}")

if __name__ == "__main__":
    sync()
