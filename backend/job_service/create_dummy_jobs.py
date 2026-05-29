import os
import django
import random
import uuid
from django.utils.text import slugify

# Set up Django for job_service
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'job_service.settings')
django.setup()

from jobs.models import Job, JobCategory

RECRUITER_ID = "62b742cb-664a-4230-806f-1c9af6bab25b"
CATEGORY_ID = "74f06e3f-a066-4560-ab4b-a4aa737246ac"

jobs_data = [
    ("Senior Backend Engineer", "Responsible for building scalable APIs using Python, Django, and PostgreSQL. Experience with Kafka and microservices is a plus."),
    ("Frontend Developer (Angular)", "Looking for an Angular expert to build high-performance web applications. Strong CSS and TypeScript skills required."),
    ("Full Stack Developer", "Experience in React and Node.js. Knowledge of AWS and CI/CD pipelines is essential."),
    ("Data Scientist", "Analyze large datasets using Python, Pandas, and Scikit-learn. Experience with NLP and LLMs is preferred."),
    ("DevOps Engineer", "Manage Kubernetes clusters and automate infrastructure using Terraform and Ansible."),
    ("Mobile App Developer (Flutter)", "Build cross-platform mobile apps using Flutter and Dart. Strong UI/UX focus."),
    ("Cybersecurity Analyst", "Monitor systems for security breaches and implement protective measures. Knowledge of SOC and penetration testing."),
    ("Machine Learning Engineer", "Design and deploy ML models using PyTorch or TensorFlow. Experience with computer vision is a plus."),
    ("Cloud Architect (AWS)", "Design secure and scalable cloud infrastructure on AWS. Strong networking background."),
    ("QA Automation Engineer", "Write automated test scripts using Selenium and Pytest. Focus on end-to-end testing."),
    ("Data Engineer", "Build and maintain data pipelines using Spark, Airflow, and Snowflake."),
    ("UI/UX Designer", "Design intuitive user interfaces using Figma. Experience with user research and prototyping."),
    ("Product Manager (Tech)", "Lead the product lifecycle from concept to launch. Strong communication and analytical skills."),
    ("Site Reliability Engineer (SRE)", "Ensure system uptime and performance using observability tools like Prometheus and Grafana."),
    ("Blockchain Developer", "Develop smart contracts using Solidity on Ethereum. Understanding of Web3 technologies."),
    ("Game Developer (Unity)", "Create immersive games using Unity and C#. Strong 3D math skills required."),
    ("Embedded Systems Engineer", "Program microcontrollers using C/C++. Experience with RTOS and IoT devices."),
    ("Network Engineer", "Manage and optimize corporate networks. CCNA/CCNP certification preferred."),
    ("Database Administrator (DBA)", "Optimize PostgreSQL and MongoDB performance. Experience with backups and recovery."),
    ("Systems Analyst", "Bridge the gap between business requirements and technical implementation."),
    ("Java Developer (Spring Boot)", "Build enterprise-grade applications using Java and Spring Boot. Microservices experience preferred."),
    ("Go Backend Developer", "High-performance backend services using Go and gRPC."),
    ("Rust Engineer", "Systems programming and safe high-performance software development with Rust."),
    ("NLP Researcher", "Research and develop advanced natural language processing models."),
    ("Computer Vision Engineer", "Build real-time image processing systems using OpenCV and deep learning."),
    ("IT Support Specialist", "Provide technical support to employees and maintain internal hardware/software."),
    ("Solutions Architect", "Design technical solutions for client business problems."),
    ("Android Developer (Kotlin)", "Develop native Android apps using Kotlin and Jetpack Compose."),
    ("iOS Developer (Swift)", "Develop native iOS apps using Swift and SwiftUI."),
    ("Technical Writer", "Create clear and concise documentation for developers and users."),
    ("Scrum Master", "Facilitate agile ceremonies and help teams deliver value faster."),
    ("Big Data Architect", "Design large-scale data storage and processing systems."),
    ("ERP Consultant", "Implement and customize ERP systems like SAP or Odoo."),
    ("Salesforce Developer", "Customize Salesforce platforms using Apex and Lightning components."),
    ("PHP Developer (Laravel)", "Build web applications using PHP and the Laravel framework."),
    ("C# / .NET Developer", "Develop Windows and web applications using C# and .NET Core."),
    ("Ruby on Rails Developer", "Rapidly build web startups using Ruby on Rails."),
    ("Security Engineer", "Implement security protocols and perform vulnerability assessments."),
    ("Infrastructure Engineer", "Maintain servers, storage, and networking hardware."),
    ("AI Ethicist", "Ensure AI systems are fair, transparent, and unbiased.")
]

def create_jobs():
    category = JobCategory.objects.get(id=CATEGORY_ID)
    count = 0
    for title, desc in jobs_data:
        slug = slugify(f"{title}-{uuid.uuid4().hex[:6]}")
        Job.objects.create(
            recruiter_id=RECRUITER_ID,
            category=category,
            title=title,
            slug=slug,
            description=desc,
            location_type=random.choice(['remote', 'hybrid', 'onsite']),
            location_city=random.choice(['Bangalore', 'Mumbai', 'Pune', 'Hyderabad', 'Remote']),
            salary_min=random.randint(5, 15) * 100000,
            salary_max=random.randint(16, 40) * 100000,
            experience_required=random.choice(['1-3 years', '3-5 years', '5+ years']),
            status='published'
        )
        count += 1
    print(f"Successfully created {count} jobs.")

if __name__ == "__main__":
    create_jobs()
