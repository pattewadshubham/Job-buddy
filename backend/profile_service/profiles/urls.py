from django.urls import path
from .views import (
    HealthView, SeekerProfileView, RecruiterProfileView,
    SkillListView, SeekerSkillView, ExperienceView,
    ResumeUploadView, ResumeURLView, ResumeDownloadView, SeekerProfileByIdView
)

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('seeker/', SeekerProfileView.as_view()),
    path('recruiter/', RecruiterProfileView.as_view()),
    path('skills/', SkillListView.as_view()),
    path('seeker/skills/', SeekerSkillView.as_view()),
    path('seeker/experience/', ExperienceView.as_view()),
    path('seeker/resumes/', ResumeUploadView.as_view()),
    path('seeker/resumes/<uuid:resume_id>/url/', ResumeURLView.as_view()),
    path('seeker/resumes/<uuid:resume_id>/download/', ResumeDownloadView.as_view()),
    path('seeker/<uuid:seeker_id>/', SeekerProfileByIdView.as_view()),
]
