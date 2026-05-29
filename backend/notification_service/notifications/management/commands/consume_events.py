import json
from kafka import KafkaConsumer
from django.conf import settings
from django.core.management.base import BaseCommand

from notifications.utils import create_notification, send_notification_email


TOPICS = ['application.stage_changed', 'interview.scheduled', 'user.registered']


class Command(BaseCommand):
    help = 'Consume Kafka notification events and persist in-app notifications.'

    def handle(self, *args, **options):
        consumer = KafkaConsumer(
            *TOPICS,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True,
            group_id='notification_service_group',
        )
        self.stdout.write(self.style.SUCCESS(f'Listening on topics: {TOPICS}'))

        for message in consumer:
            payload = message.value
            topic = message.topic

            if topic == 'application.stage_changed':
                user_id = payload.get('seeker_id')
                if user_id:
                    create_notification(
                        user_id=user_id,
                        notification_type=topic,
                        title='Application stage updated',
                        body=f"Your application moved to: {payload.get('new_stage', 'updated')}",
                        payload=payload,
                    )

            elif topic == 'interview.scheduled':
                user_id = payload.get('seeker_id')
                email = payload.get('seeker_email')
                scheduled_at = payload.get('scheduled_at', 'TBD')
                jitsi_link = payload.get('jitsi_link', '')
                job_title = payload.get('job_title') or 'your application'
                if user_id:
                    create_notification(
                        user_id=user_id,
                        notification_type=topic,
                        title='Interview scheduled',
                        body=f"Interview scheduled for {job_title} at {scheduled_at}. Join here: {jitsi_link}",
                        payload=payload,
                    )
                    send_notification_email(
                        to_email=email,
                        subject='Interview scheduled',
                        message=(
                            f"Your interview for {job_title} is scheduled at {scheduled_at}.\n"
                            f"Join link: {jitsi_link}"
                        ),
                    )

            elif topic == 'user.registered':
                user_id = payload.get('user_id')
                email = payload.get('email')
                if user_id:
                    create_notification(
                        user_id=user_id,
                        notification_type=topic,
                        title='Welcome to Job Buddy',
                        body='Your account was created successfully.',
                        payload=payload,
                    )
                    send_notification_email(
                        to_email=email,
                        subject='Welcome to Job Buddy',
                        message='Your account was created successfully.',
                    )
