import os
import django
import sys
import psycopg2
from decouple import config

sys.path.append(os.path.abspath("matching_service"))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'matching_service.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='match_schema';")
    tables = cursor.fetchall()
    print("Tables in match_schema:", tables)
