"""
Deprecated S3 utils. Use utils_local.py for local storage.
"""
from .utils_local import (
    save_resume_locally as upload_to_s3,
    extract_text_from_pdf,
    get_resume_url as get_presigned_url,
    publish_resume_uploaded,
    publish_resume_deleted
)

