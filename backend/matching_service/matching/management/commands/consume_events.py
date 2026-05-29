import json
from kafka import KafkaConsumer
from django.conf import settings
from django.core.management.base import BaseCommand

from matching.models import JobEmbedding, ResumeEmbedding
from matching.utils import generate_embedding


TOPICS = ['resume.uploaded', 'resume.deleted', 'job.published']


class Command(BaseCommand):
    help = 'Consume Kafka events and create/update/delete embeddings.'

    def handle(self, *args, **options):
        consumer = KafkaConsumer(
            *TOPICS,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True,
            group_id='matching_service_group',
        )
        self.stdout.write(self.style.SUCCESS(f'Listening on topics: {TOPICS}'))

        for message in consumer:
            payload = message.value
            if message.topic == 'resume.uploaded':
                resume_id = payload.get('resume_id')
                seeker_id = payload.get('seeker_id')
                raw_text = payload.get('raw_text', '')
                if resume_id and seeker_id:
                    vector = generate_embedding(raw_text)
                    ResumeEmbedding.objects.update_or_create(
                        resume_id=resume_id,
                        defaults={'seeker_id': seeker_id, 'embedding': vector},
                    )
            elif message.topic == 'resume.deleted':
                resume_id = payload.get('resume_id')
                if resume_id:
                    ResumeEmbedding.objects.filter(resume_id=resume_id).delete()
            elif message.topic == 'job.published':
                job_id = payload.get('job_id')
                description_text = payload.get('description_text', '')
                if job_id:
                    vector = generate_embedding(description_text)
                    JobEmbedding.objects.update_or_create(
                        job_id=job_id,
                        defaults={'embedding': vector},
                    )
