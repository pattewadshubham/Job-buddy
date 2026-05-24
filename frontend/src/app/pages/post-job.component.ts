import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

interface Category {
  id: string;
  name: string;
}

interface RecruiterJob {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  location_type: string;
  location_city: string;
  experience_required: string;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
}

interface Applicant {
  id: string;
  seeker_id: string;
  seeker_email: string;
  job_id: string;
  job_title: string;
  resume_id: string;
  cover_letter: string;
  current_stage: string;
  created_at: string;
}

interface SeekerProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  current_title: string;
  summary: string;
  github_url: string;
  linkedin_url: string;
  skills: Array<{ id: string; skill_name: string; years_of_experience: number }>;
  experiences: Array<{
    id: string;
    company_name: string;
    role_title: string;
    start_date: string;
    end_date: string | null;
    description: string;
  }>;
}

interface InterviewResponse {
  id: string;
  scheduled_at: string;
  expires_at: string;
  jitsi_link: string;
  recruiter_notes: string;
  is_expired: boolean;
}

@Component({
  selector: 'app-post-job-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Recruiter workspace</p>
          <h1>Post and manage jobs</h1>
        </div>
        @if (!isRecruiter()) {
          <a routerLink="/login" class="inline-link">Login as recruiter</a>
        }
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-card">Login first to create recruiter jobs.</div>
      } @else if (!isRecruiter()) {
        <div class="empty-card">This page is intended for recruiter accounts only.</div>
      } @else {
        <div class="tabs">
          <button type="button" [class.active]="activeTab() === 'create'" (click)="activeTab.set('create')">Create Job</button>
          <button type="button" [class.active]="activeTab() === 'manage'" (click)="activeTab.set('manage')">Manage Jobs</button>
        </div>

        @if (activeTab() === 'create') {
          <article class="form-card">
            <h2>{{ editingJobId() ? 'Edit job' : 'Create a new job' }}</h2>
            <div class="grid">
              <label>
                <span>Title</span>
                <input [(ngModel)]="form.title" type="text" />
              </label>
              <label>
                <span>Category</span>
                <select [(ngModel)]="form.category">
                  <option value="">Select category</option>
                  @for (category of categories(); track category.id) {
                    <option [value]="category.id">{{ category.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Location type</span>
                <select [(ngModel)]="form.location_type">
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </label>
              <label>
                <span>Location city</span>
                <input [(ngModel)]="form.location_city" type="text" />
              </label>
              <label>
                <span>Salary min</span>
                <input [(ngModel)]="form.salary_min" type="number" />
              </label>
              <label>
                <span>Salary max</span>
                <input [(ngModel)]="form.salary_max" type="number" />
              </label>
              <label>
                <span>Experience required</span>
                <input [(ngModel)]="form.experience_required" type="text" />
              </label>
              <label>
                <span>Primary skill</span>
                <input [(ngModel)]="form.skill_name" type="text" />
              </label>
            </div>
            <label>
              <span>Description</span>
              <textarea [(ngModel)]="form.description" rows="8"></textarea>
            </label>
            <div class="actions">
              @if (editingJobId()) {
                <button type="button" (click)="updateJob()">Save changes</button>
                <button type="button" class="secondary" (click)="cancelEdit()">Cancel</button>
              } @else {
                <button type="button" (click)="createJob()">Create job</button>
              }
            </div>
            @if (message()) {
              <div class="message">{{ message() }}</div>
            }
          </article>
        } @else {
          <div class="manage-layout">
            <article class="jobs-panel">
              <div class="list-head">
                <h2>My jobs</h2>
                <button type="button" class="secondary" (click)="loadMyJobs()">Refresh</button>
              </div>
              @if (message()) {
                <div class="message">{{ message() }}</div>
              }
              @if (jobsLoading()) {
                <div class="empty-card small">Loading recruiter jobs...</div>
              } @else if (!myJobs().length) {
                <div class="empty-card small">No jobs created yet.</div>
              } @else {
                <div class="job-grid">
                  @for (job of myJobs(); track job.id) {
                    <article class="job-card" [class.selected]="selectedJobId() === job.id">
                      <div class="job-header">
                        <div>
                          <h3>{{ job.title }}</h3>
                          <p class="job-meta">{{ job.location_type }} @if (job.location_city) { · {{ job.location_city }} }</p>
                        </div>
                        <span class="status-pill" [class.archived]="job.is_archived">
                          {{ job.is_archived ? 'archived' : job.status }}
                        </span>
                      </div>
                      <p class="job-desc">{{ job.description | slice:0:120 }}{{ job.description.length > 120 ? '...' : '' }}</p>
                      <div class="job-actions">
                        <button type="button" class="secondary" (click)="startEdit(job)">Edit</button>
                        <button type="button" class="secondary" (click)="openApplicants(job.id)">Applicants</button>
                        @if (!job.is_archived && job.status !== 'published') {
                          <button type="button" class="secondary" (click)="publish(job.id)">Publish</button>
                        }
                        @if (!job.is_archived && job.status !== 'closed') {
                          <button type="button" class="secondary" (click)="close(job.id)">Close</button>
                        }
                        @if (!job.is_archived) {
                          <button type="button" class="secondary" (click)="archive(job.id)">Archive</button>
                        } @else {
                          <button type="button" class="secondary" (click)="restore(job.id)">Restore</button>
                        }
                      </div>
                    </article>
                  }
                </div>
              }
            </article>

            <article class="applicants-panel">
              <div class="list-head">
                <h2>Applicants {{ selectedJob() ? 'for "' + selectedJob()!.title + '"' : '' }}</h2>
                @if (selectedJob(); as currentJob) {
                  <button type="button" class="secondary" (click)="openApplicants(currentJob.id)">Refresh</button>
                }
              </div>

              @if (!selectedJob()) {
                <div class="empty-card small">Select a job from the left to view applicants.</div>
              } @else if (selectedJob(); as currentJob) {
                @if (applicationsLoading()) {
                  <div class="empty-card small">Loading applicants...</div>
                } @else if (!applications().length) {
                  <div class="empty-card small">No applicants yet.</div>
                } @else {
                  <div class="applicant-list">
                    @for (application of applications(); track application.id) {
                      <article class="applicant-card">
                        <div class="applicant-header">
                          <div class="applicant-info">
                            <h3>{{ application.seeker_email || application.seeker_id }}</h3>
                            <p class="meta-line">Applied {{ application.created_at | date: 'short' }}</p>
                          </div>
                          <span class="status-pill">{{ application.current_stage }}</span>
                        </div>

                        <p class="cover-letter">{{ application.cover_letter || 'No cover letter provided' }}</p>

                        <div class="applicant-actions">
                          <button type="button" class="secondary" (click)="viewProfile(application.seeker_id)">Profile</button>

                          @if (application.resume_id) {
                            <button type="button" class="secondary" (click)="viewResume(application.resume_id)">View Resume</button>
                          }

                          <button type="button" class="secondary" (click)="toggleSchedule(application.id)">
                            {{ schedulingApplicationId() === application.id ? 'Cancel' : 'Schedule' }}
                          </button>
                        </div>

                        @if (schedulingApplicationId() === application.id) {
                          <div class="schedule-form">
                            <label>
                              <span>Date and time</span>
                              <input [(ngModel)]="scheduleDateTime" type="datetime-local" />
                            </label>
                            <label>
                              <span>Recruiter notes</span>
                              <textarea [(ngModel)]="scheduleNotes" rows="2"></textarea>
                            </label>
                            <button type="button" (click)="scheduleInterview(application.id)">Generate interview link</button>
                          </div>
                        }
                      </article>
                    }
                  </div>
                }
              }

              @if (interviewMessage()) {
                <div class="message">{{ interviewMessage() }}</div>
              }
            </article>
          </div>

          @if (viewingProfile(); as profile) {
            <div class="modal-overlay" (click)="closeProfile()">
              <article class="modal-card" (click)="$event.stopPropagation()">
                <div class="profile-header">
                  <h2>{{ profile.first_name }} {{ profile.last_name }}</h2>
                  <button type="button" class="close-btn" (click)="closeProfile()">Close</button>
                </div>
                  <div class="profile-section">
                    <p><strong>Current Title:</strong> {{ profile.current_title || 'Not specified' }}</p>
                    <p><strong>Phone:</strong> {{ profile.phone || 'Not provided' }}</p>
                    @if (profile.github_url) {
                      <p><strong>GitHub:</strong> <a [href]="profile.github_url" target="_blank" rel="noreferrer">{{ profile.github_url }}</a></p>
                    }
                    @if (profile.linkedin_url) {
                      <p><strong>LinkedIn:</strong> <a [href]="profile.linkedin_url" target="_blank" rel="noreferrer">{{ profile.linkedin_url }}</a></p>
                    }
                  </div>
                  @if (profile.summary) {
                    <div class="profile-section">
                      <h4>Summary</h4>
                      <p>{{ profile.summary }}</p>
                    </div>
                  }
                  @if (profile.skills?.length) {
                    <div class="profile-section">
                      <h4>Skills</h4>
                      <div class="skills-grid">
                        @for (skill of profile.skills; track skill.id) {
                          <span class="skill-tag">{{ skill.skill_name }} ({{ skill.years_of_experience }}y)</span>
                        }
                      </div>
                    </div>
                  }
                  @if (profile.experiences?.length) {
                    <div class="profile-section">
                      <h4>Experience</h4>
                      @for (exp of profile.experiences; track exp.id) {
                        <div class="experience-item">
                          <p><strong>{{ exp.role_title }}</strong> at {{ exp.company_name }}</p>
                          <p class="meta-line">{{ exp.start_date | date: 'MMM yyyy' }} - {{ exp.end_date ? (exp.end_date | date: 'MMM yyyy') : 'Present' }}</p>
                          @if (exp.description) {
                            <p>{{ exp.description }}</p>
                          }
                        </div>
                      }
                    </div>
                  }
              </article>
            </div>
          }

          @if (scheduledInterview(); as interview) {
            <article class="interview-banner">
              <h3>Latest interview scheduled</h3>
              <p><strong>Time:</strong> {{ interview.scheduled_at | date: 'medium' }}</p>
              <p><strong>Link:</strong> <a [href]="interview.jitsi_link" target="_blank" rel="noreferrer">{{ interview.jitsi_link }}</a></p>
              <p><strong>Notes:</strong> {{ interview.recruiter_notes || 'None' }}</p>
            </article>
          }
        }
      }
    </section>
  `,
  styles: [`
    .page-card,
    .form-card,
    .jobs-panel,
    .applicants-panel,
    .modal-card,
    .empty-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card { display: grid; gap: 1.5rem; padding: 1.5rem; }
    .tabs { display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    .tabs button { background: transparent; border: none; color: var(--muted); padding: 0.75rem 1.5rem; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
    .tabs button.active { background: #e0e7ff; color: #3730a3; }
    .tabs button:hover { background: #f1f5f9; }
    
    .form-card,
    .jobs-panel,
    .applicants-panel { padding: 1.5rem; }
    
    .manage-layout { display: grid; gap: 1.5rem; grid-template-columns: 1fr 1fr; }
    
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 1rem; }
    
    .list-head,
    .page-head,
    .actions { display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap; }
    
    .job-grid { display: grid; gap: 1rem; margin-top: 1rem; }
    .job-card { 
      display: flex;
      flex-direction: column;
      background: var(--card); 
      border: 1px solid var(--border);
      border-radius: 18px; 
      padding: 1.25rem; 
      cursor: pointer;
      transition: all 0.2s;
    }
    .job-card:hover { border-color: var(--accent); transform: translateY(-2px); }
    .job-card.selected { border-color: var(--accent); background: #eff6ff; }
    
    .job-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
    .job-meta { color: var(--muted); font-size: 0.9rem; margin: 0.25rem 0 0 0; }
    .job-desc { color: var(--muted); font-size: 0.95rem; margin: 0.5rem 0; }
    
    .job-actions { 
      display: flex; 
      gap: 0.5rem; 
      flex-wrap: wrap; 
      margin-top: auto; 
      padding-top: 1rem;
    }
    .job-actions button { padding: 0.4rem 0.8rem; font-size: 0.85rem; min-height: auto; }
    
    .applicant-list { display: grid; gap: 1rem; margin-top: 1rem; max-height: 70vh; overflow-y: auto; }
    .applicant-card { 
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: var(--card); 
      border-radius: 18px; 
      padding: 1.25rem;
      border: 1px solid var(--border);
    }
    
    .applicant-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .applicant-info { display: grid; gap: 0.25rem; }
    .cover-letter { color: var(--muted); font-size: 0.9rem; font-style: italic; margin: 0; }
    .applicant-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    
    .schedule-form { 
      display: grid; 
      gap: 1rem; 
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 12px;
    }
    
    .message,
    .small { margin-top: 1rem; padding: 1rem; }
    
    .status-pill { 
      background: #e0e7ff; 
      border-radius: 999px; 
      color: #3730a3; 
      padding: 0.45rem 0.8rem; 
      text-transform: capitalize;
      font-size: 0.85rem;
      white-space: nowrap;
      font-weight: 500;
    }
    .status-pill.archived { background: #f1f5f9; color: #475569; }
    
    .meta-line { margin: 0; color: var(--muted); font-size: 0.9rem; }
    
    .modal-overlay { 
      position: fixed; 
      top: 0; 
      left: 0; 
      right: 0; 
      bottom: 0; 
      background: rgba(0, 0, 0, 0.7); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      z-index: 1000;
      padding: 2rem;
    }
    .modal-card { 
      max-width: 700px; 
      width: 100%; 
      max-height: 85vh; 
      overflow-y: auto; 
      padding: 2rem;
    }
    
    .profile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .close-btn { 
      background: #fee2e2; 
      border: none; 
      border-radius: 8px; 
      padding: 0.4rem 1rem;
      cursor: pointer; 
      font-size: 0.95rem;
      font-weight: 500;
      color: #991b1b;
      transition: all 0.2s;
    }
    .close-btn:hover { background: #fecaca; }
    
    .profile-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
    .profile-section:first-of-type { border-top: none; padding-top: 0; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .skill-tag { background: #dbeafe; border-radius: 999px; color: #1e40af; padding: 0.35rem 0.7rem; font-size: 0.9rem; font-weight: 500; }
    .experience-item { margin-top: 0.8rem; padding: 0.8rem; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; }
    
    .interview-banner { 
      background: #ecfdf5; 
      border: 1px solid #6ee7b7;
      border-radius: 18px; 
      padding: 1.25rem;
      margin-top: 1rem;
      color: #065f46;
    }
    
    @media (max-width: 980px) {
      .manage-layout,
      .grid { grid-template-columns: 1fr; }
      .modal-overlay { padding: 1rem; }
    }
  `],
})
export class PostJobComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly categories = signal<Category[]>([]);
  readonly myJobs = signal<RecruiterJob[]>([]);
  readonly jobsLoading = signal(false);
  readonly applicationsLoading = signal(false);
  readonly message = signal('');
  readonly interviewMessage = signal('');
  readonly isRecruiter = computed(() => this.auth.role() === 'recruiter');
  readonly editingJobId = signal('');
  readonly selectedJobId = signal('');
  readonly applications = signal<Applicant[]>([]);
  readonly schedulingApplicationId = signal('');
  readonly scheduledInterview = signal<InterviewResponse | null>(null);
  readonly selectedJob = computed(() => this.myJobs().find((job) => job.id === this.selectedJobId()) ?? null);
  readonly viewingProfile = signal<SeekerProfile | null>(null);

  readonly activeTab = signal<'create' | 'manage'>('manage');

  readonly form = {
    title: '',
    description: '',
    category: '',
    location_type: 'remote',
    location_city: '',
    salary_min: 80000,
    salary_max: 120000,
    currency: 'INR',
    experience_required: '2 years',
    skill_name: 'Python',
  };

  scheduleDateTime = '';
  scheduleNotes = '';

  ngOnInit(): void {
    this.api.get<Category[]>(`${this.api.jobsBase}/categories/`).subscribe({
      next: (categories) => this.categories.set(categories),
    });

    if (this.isRecruiter()) {
      this.loadMyJobs();
    }
  }
protected viewResume(resumeId: string): void {
    if (!resumeId) {
      this.interviewMessage.set('No resume was attached to this application.');
      return;
    }

    this.interviewMessage.set('Loading resume securely...');
    
    // Hit the secure download endpoint, which requires the Bearer token
    this.api.getBlob(`${this.api.profileBase}/seeker/resumes/${resumeId}/download/`, true).subscribe({
      next: (blob) => {
        this.interviewMessage.set('');
        // Create a secure, temporary local URL for the PDF blob
        const fileUrl = window.URL.createObjectURL(blob);
        // Open the PDF in a new tab
        window.open(fileUrl, '_blank');
        
        // Optional cleanup: Revoke the URL after a short delay to free memory
        setTimeout(() => window.URL.revokeObjectURL(fileUrl), 10000);
      },
      error: (error) => {
        console.error(error);
        this.interviewMessage.set('Failed to load resume. You may not have permission.');
      },
    });
  }

  protected createJob(): void {
    const payload = {
      title: this.form.title,
      description: this.form.description,
      category: this.form.category || null,
      location_type: this.form.location_type,
      location_city: this.form.location_city,
      salary_min: this.form.salary_min,
      salary_max: this.form.salary_max,
      currency: this.form.currency,
      experience_required: this.form.experience_required,
      skills: this.form.skill_name ? [{ skill_name: this.form.skill_name, is_required: true }] : [],
    };

    this.api.post(`${this.api.jobsBase}/create/`, payload, true).subscribe({
      next: () => {
        this.message.set('Job created successfully.');
        this.resetForm();
        this.loadMyJobs();
        this.activeTab.set('manage');
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected startEdit(job: RecruiterJob): void {
    this.editingJobId.set(job.id);
    this.form.title = job.title;
    this.form.description = job.description;
    this.form.location_type = job.location_type;
    this.form.location_city = job.location_city;
    this.form.salary_min = job.salary_min ?? 0;
    this.form.salary_max = job.salary_max ?? 0;
    this.form.experience_required = job.experience_required;
    this.activeTab.set('create');
  }

  protected cancelEdit(): void {
    this.editingJobId.set('');
    this.resetForm();
    this.activeTab.set('manage');
  }

  protected updateJob(): void {
    const jobId = this.editingJobId();
    if (!jobId) return;

    const payload = {
      title: this.form.title,
      description: this.form.description,
      location_type: this.form.location_type,
      location_city: this.form.location_city,
      salary_min: this.form.salary_min,
      salary_max: this.form.salary_max,
      experience_required: this.form.experience_required,
      skills: this.form.skill_name ? [{ skill_name: this.form.skill_name, is_required: true }] : [],
    };

    this.api.patch(`${this.api.jobsBase}/${jobId}/`, payload, true).subscribe({
      next: () => {
        this.message.set('Job updated.');
        this.cancelEdit();
        this.loadMyJobs();
        this.activeTab.set('manage');
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected publish(jobId: string): void {
    this.api.post(`${this.api.jobsBase}/${jobId}/publish/`, {}, true).subscribe({
      next: () => {
        this.message.set('Job published.');
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected close(jobId: string): void {
    this.api.post(`${this.api.jobsBase}/${jobId}/close/`, {}, true).subscribe({
      next: () => {
        this.message.set('Job closed.');
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected archive(jobId: string): void {
    this.api.post(`${this.api.jobsBase}/${jobId}/archive/`, {}, true).subscribe({
      next: () => {
        this.message.set('Job archived.');
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected restore(jobId: string): void {
    this.api.post(`${this.api.jobsBase}/${jobId}/restore/`, {}, true).subscribe({
      next: () => {
        this.message.set('Job restored.');
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected openApplicants(jobId: string): void {
    this.selectedJobId.set(jobId);
    this.schedulingApplicationId.set('');
    this.scheduleDateTime = '';
    this.scheduleNotes = '';
    this.interviewMessage.set('');
    this.scheduledInterview.set(null);
    this.loadApplications(jobId);
  }

  protected toggleSchedule(applicationId: string): void {
    if (this.schedulingApplicationId() === applicationId) {
      this.schedulingApplicationId.set('');
      this.scheduleDateTime = '';
      this.scheduleNotes = '';
      return;
    }
    this.schedulingApplicationId.set(applicationId);
    this.scheduleDateTime = '';
    this.scheduleNotes = '';
    this.interviewMessage.set('');
  }

  protected scheduleInterview(applicationId: string): void {
    if (!this.scheduleDateTime) {
      this.interviewMessage.set('Pick an interview date and time first.');
      return;
    }

    const scheduledAt = new Date(this.scheduleDateTime);
    if (Number.isNaN(scheduledAt.getTime())) {
      this.interviewMessage.set('Enter a valid interview date and time.');
      return;
    }

    this.api.post<InterviewResponse>(`${this.api.applicationsBase}/${applicationId}/schedule-interview/`, {
      scheduled_at: scheduledAt.toISOString(),
      recruiter_notes: this.scheduleNotes,
    }, true).subscribe({
      next: (interview) => {
        this.scheduledInterview.set(interview);
        this.interviewMessage.set('Interview scheduled and email notification queued for the candidate.');
        this.schedulingApplicationId.set('');
        this.scheduleDateTime = '';
        this.scheduleNotes = '';
        if (this.selectedJobId()) {
          this.loadApplications(this.selectedJobId());
        }
      },
      error: (error) => this.interviewMessage.set(this.errorMessage(error)),
    });
  }

  protected viewProfile(seekerId: string): void {
    this.api.get<SeekerProfile>(`${this.api.profileBase}/seeker/${seekerId}/`, true).subscribe({
      next: (profile) => this.viewingProfile.set(profile),
      error: (error) => this.interviewMessage.set(this.errorMessage(error)),
    });
  }

  protected closeProfile(): void {
    this.viewingProfile.set(null);
  }

  protected loadMyJobs(): void {
    this.jobsLoading.set(true);
    this.message.set('');
    this.api.get<RecruiterJob[]>(`${this.api.jobsBase}/my/`, true).subscribe({
      next: (jobs) => {
        this.myJobs.set(jobs);
        const selected = this.selectedJobId();
        if (selected && jobs.some((job) => job.id === selected)) {
          this.loadApplications(selected);
        } else if (!selected && jobs.length) {
          this.selectedJobId.set(jobs[0].id);
          this.loadApplications(jobs[0].id);
        } else if (selected && !jobs.some((job) => job.id === selected)) {
          this.selectedJobId.set('');
          this.applications.set([]);
        }
        this.jobsLoading.set(false);
      },
      error: (error) => {
        const errMsg = this.errorMessage(error);
        if (errMsg.includes('Invalid or expired token')) {
          this.message.set('Your session has expired. Please log in again.');
        } else {
          this.message.set(errMsg);
        }
        this.jobsLoading.set(false);
      },
    });
  }

  private loadApplications(jobId: string): void {
    this.applicationsLoading.set(true);
    this.api.get<Applicant[]>(`${this.api.applicationsBase}/job/${jobId}/`, true).subscribe({
      next: (applications) => {
        this.applications.set(applications);
        this.applicationsLoading.set(false);
      },
      error: (error) => {
        this.interviewMessage.set(this.errorMessage(error));
        this.applicationsLoading.set(false);
      },
    });
  }

  private resetForm(): void {
    this.form.title = '';
    this.form.description = '';
    this.form.category = '';
    this.form.location_type = 'remote';
    this.form.location_city = '';
    this.form.salary_min = 80000;
    this.form.salary_max = 120000;
    this.form.currency = 'INR';
    this.form.experience_required = '2 years';
    this.form.skill_name = 'Python';
  }

  private errorMessage(error: { error?: unknown; message?: string }): string {
    if (typeof error.error === 'string') return error.error;
    if (error.error && typeof error.error === 'object') return JSON.stringify(error.error);
    return error.message ?? 'Request failed';
  }
}