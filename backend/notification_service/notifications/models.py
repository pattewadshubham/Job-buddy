import uuid
from django.db import models


class Notification(models.Model):
    TYPE_CHOICES = [
        ('application.stage_changed', 'Application Stage Changed'),
        ('application.received', 'Application Received'),
        ('interview.scheduled', 'Interview Scheduled'),
        ('user.registered', 'User Registered'),
        ('system', 'System'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    notification_type = models.CharField(max_length=64, choices=TYPE_CHOICES, default='system')
    title = models.CharField(max_length=180)
    body = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
