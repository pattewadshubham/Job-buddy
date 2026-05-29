import os
import uuid
import fitz  # PyMuPDF
from django.conf import settings
from kafka import KafkaProducer
import json
from django.core.files.storage import default_storage


def save_resume_locally(file, seeker_id):
    filename = f"resumes/{seeker_id}/{uuid.uuid4()}.pdf"
    path = default_storage.save(filename, file)
    return path


def extract_text_from_pdf(file):
    try:
        file.seek(0)
        doc = fitz.open(stream=file.read(), filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text
    except Exception:
        return ""


def get_resume_url(local_path):
    return f"{settings.MEDIA_URL}{local_path}"


def publish_resume_uploaded(resume_id, seeker_id, raw_text):
    try:
        producer = KafkaProducer(
            bootstrap_servers=getattr(settings, 'KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        producer.send('resume.uploaded', {
            'resume_id': str(resume_id),
            'seeker_id': str(seeker_id),
            'raw_text': raw_text,
        })
        producer.flush()
    except Exception:
        pass  # Kafka optional locally


def publish_resume_deleted(resume_id, seeker_id):
    try:
        producer = KafkaProducer(
            bootstrap_servers=getattr(settings, 'KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        producer.send('resume.deleted', {
            'resume_id': str(resume_id),
            'seeker_id': str(seeker_id),
        })
        producer.flush()
    except Exception:
        pass  # Kafka optional locally

