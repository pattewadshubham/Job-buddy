import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

interface SeekerSkill {
  id: string;
  skill_name: string;
  years_of_experience: number;
}

interface ResumeItem {
  id: string;
  resume_title: string;
  is_primary: boolean;
  parsing_status: string;
  created_at: string;
}

interface ApplicationItem {
  id: string;
  job_id: string;
  job_title?: string;
  resume_id?: string; // Added to track which resume was submitted
  current_stage: string;
  created_at: string;
}

// Added to type the fetched job details
interface JobDetails {
  id: string;
  title: string;
  description: string;
  location_type: string;
  location_city: string;
  experience_required: string;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Profile service</p>
          <h1>Profile and activity</h1>
        </div>
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-card">
          Login first to access your profile.
          <a routerLink="/login" class="inline-link">Go to login</a>
        </div>
      } @else {
        
        @if (isSeeker()) {
          <div class="tabs">
            <button type="button" [class.active]="activeTab() === 'profile'" (click)="activeTab.set('profile')">My Profile</button>
            <button type="button" [class.active]="activeTab() === 'applications'" (click)="activeTab.set('applications')">My Applications</button>
          </div>
        }

        @if (isSeeker()) {
          
          @if (activeTab() === 'profile') {
            <div class="profile-layout">
              <div class="column-stack">
                <article class="panel-card">
                  <div class="section-head">
                    <h2>Seeker profile</h2>
                    <button type="button" class="secondary" (click)="editMode.set(!editMode())">
                      {{ editMode() ? 'Cancel edit' : 'Edit profile' }}
                    </button>
                  </div>

                  @if (!editMode()) {
                    <div class="info-grid">
                      <p><strong>Name:</strong> {{ seeker.first_name }} {{ seeker.last_name }}</p>
                      <p><strong>Phone:</strong> {{ seeker.phone || '-' }}</p>
                      <p><strong>Title:</strong> {{ seeker.current_title || '-' }}</p>
                      <p><strong>GitHub:</strong> {{ seeker.github_url || '-' }}</p>
                      <p><strong>LinkedIn:</strong> {{ seeker.linkedin_url || '-' }}</p>
                      <p><strong>Summary:</strong> {{ seeker.summary || '-' }}</p>
                    </div>
                  } @else {
                    <div class="grid">
                      <label><span>First name</span><input [(ngModel)]="seeker.first_name" type="text" /></label>
                      <label><span>Last name</span><input [(ngModel)]="seeker.last_name" type="text" /></label>
                      <label><span>Phone</span><input [(ngModel)]="seeker.phone" type="text" /></label>
                      <label><span>Current title</span><input [(ngModel)]="seeker.current_title" type="text" /></label>
                    </div>
                    <label><span>Summary</span><textarea [(ngModel)]="seeker.summary" rows="4"></textarea></label>
                    <div class="grid">
                      <label><span>GitHub URL</span><input [(ngModel)]="seeker.github_url" type="text" /></label>
                      <label><span>LinkedIn URL</span><input [(ngModel)]="seeker.linkedin_url" type="text" /></label>
                    </div>
                    <div class="actions">
                      <button type="button" (click)="saveSeeker()">Save profile</button>
                      <button type="button" class="secondary" (click)="loadSeeker()">Reload</button>
                    </div>
                  }
                  @if (message()) {
                    <div class="message">{{ message() }}</div>
                  }
                </article>
              </div>

              <div class="column-stack">
                <article class="panel-card">
                  <h3>Skills</h3>
                  @if (!skills().length) {
                    <p class="muted">No skills added yet.</p>
                  } @else {
                    <div class="chips">
                      @for (item of skills(); track item.id) {
                        <span class="chip">{{ item.skill_name }} ({{ item.years_of_experience }}y)</span>
                      }
                    </div>
                  }
                  <div class="grid skill-inputs">
                    <label><span>Skill name</span><input [(ngModel)]="skill.skill_name" type="text" placeholder="e.g. Python" /></label>
                    <label><span>Years of experience</span><input [(ngModel)]="skill.years_of_experience" type="number" min="0" /></label>
                  </div>
                  <button type="button" class="secondary" (click)="addSkill()">Add skill</button>
                </article>

                <article class="panel-card">
                  <h3>Resume upload</h3>
                  <div class="grid">
                    <label><span>Title</span><input [(ngModel)]="resumeTitle" type="text" placeholder="Backend Resume" /></label>
                    <label><span>PDF file</span><input type="file" accept="application/pdf" (change)="onResumeSelect($event)" class="file-input" /></label>
                  </div>
                  <button type="button" class="secondary" (click)="uploadResume()">Upload resume</button>
                  @if (resumes().length) {
                    <div class="list compact">
                      @for (item of resumes(); track item.id) {
                        <div class="list-item">
                          <strong>{{ item.resume_title }}</strong>
                          <p class="meta-line">{{ item.parsing_status }} · {{ item.created_at | date: 'medium' }}</p>
                        </div>
                      }
                    </div>
                  }
                </article>
              </div>
            </div>
          } @else {
            <article class="panel-card">
              <div class="section-head">
                <h2>My applications</h2>
                <button type="button" class="secondary" (click)="loadApplications()">Refresh</button>
              </div>
              
              @if (applicationsLoading()) {
                <div class="empty-card small">Loading applications...</div>
              } @else if (!applications().length) {
                <div class="empty-card small">You haven't applied to any jobs yet.</div>
              } @else {
                <div class="app-grid">
                  @for (item of applications(); track item.id) {
                    <div class="app-card">
                      <div class="app-header">
                        <div>
                          <h3>{{ item.job_title || 'Role (ID: ' + item.job_id + ')' }}</h3>
                          <p class="meta-line">Applied on {{ item.created_at | date: 'mediumDate' }}</p>
                        </div>
                        <span class="status-pill">{{ item.current_stage }}</span>
                      </div>
                      
                      <div class="app-actions">
                        <button type="button" class="secondary" (click)="viewJobDetails(item.job_id)">View Job</button>
                        @if (item.resume_id) {
                          <button type="button" class="secondary" (click)="viewResume(item.resume_id)">View Resume</button>
                        }
                      </div>

                    </div>
                  }
                </div>
              }
              
              @if (message()) {
                <div class="message">{{ message() }}</div>
              }
            </article>
          }

        } @else {
          <article class="panel-card">
            <div class="section-head">
              <h2>Recruiter profile</h2>
              <button type="button" class="secondary" (click)="editMode.set(!editMode())">
                {{ editMode() ? 'Cancel edit' : 'Edit profile' }}
              </button>
            </div>

            @if (!editMode()) {
              <div class="info-grid">
                <p><strong>Company:</strong> {{ recruiter.company_name || '-' }}</p>
                <p><strong>Size:</strong> {{ recruiter.company_size || '-' }}</p>
                <p><strong>Industry:</strong> {{ recruiter.industry || '-' }}</p>
                <p><strong>HQ:</strong> {{ recruiter.hq_location || '-' }}</p>
                <p><strong>Website:</strong> {{ recruiter.website_url || '-' }}</p>
              </div>
            } @else {
              <div class="grid">
                <label><span>Company name</span><input [(ngModel)]="recruiter.company_name" type="text" /></label>
                <label><span>Company size</span><input [(ngModel)]="recruiter.company_size" type="text" /></label>
                <label><span>Industry</span><input [(ngModel)]="recruiter.industry" type="text" /></label>
                <label><span>HQ location</span><input [(ngModel)]="recruiter.hq_location" type="text" /></label>
              </div>
              <label><span>Website URL</span><input [(ngModel)]="recruiter.website_url" type="text" /></label>
              <div class="actions">
                <button type="button" (click)="saveRecruiter()">Save profile</button>
                <button type="button" class="secondary" (click)="loadRecruiter()">Reload</button>
              </div>
            }

            @if (message()) {
              <div class="message">{{ message() }}</div>
            }
          </article>
        }
      }

      @if (viewingJob(); as job) {
        <div class="modal-overlay" (click)="viewingJob.set(null)">
          <article class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ job.title }}</h2>
              <button type="button" class="close-btn" (click)="viewingJob.set(null)">Close</button>
            </div>
            
            <div class="modal-section">
              <p><strong>Location:</strong> {{ job.location_type }} @if(job.location_city) { · {{ job.location_city }} }</p>
              <p><strong>Experience Required:</strong> {{ job.experience_required || 'Not specified' }}</p>
              <p><strong>Salary:</strong> {{ formatSalary(job.salary_min, job.salary_max) }}</p>
              <p><strong>Status:</strong> <span class="status-pill">{{ job.status }}</span></p>
            </div>
            
            <div class="modal-section">
              <h4>Job Description</h4>
              <p class="description-text">{{ job.description }}</p>
            </div>
          </article>
        </div>
      }
    </section>
  `,
  styles: [`
    .page-card,
    .panel-card,
    .empty-card,
    .list-item,
    .app-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card { display: grid; gap: 1.5rem; padding: 1.5rem; }
    .panel-card { padding: 1.5rem; }
    
    .profile-layout { display: grid; gap: 1.5rem; grid-template-columns: 1fr 1fr; }
    .column-stack { display: flex; flex-direction: column; gap: 1.5rem; }
    
    .tabs { display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.5rem; }
    .tabs button { background: transparent; border: none; color: var(--muted); padding: 0.75rem 1.5rem; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
    .tabs button.active { background: #e0e7ff; color: #3730a3; }
    .tabs button:hover { background: #f1f5f9; }

    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 1rem; }
    .skill-inputs { align-items: end; margin-bottom: 0.5rem; }
    
    .section-head,
    .page-head,
    .actions { display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .actions { margin-top: 1rem; margin-bottom: 0; justify-content: flex-start; }
    
    h3 { margin-bottom: 1rem; }
    h4 { margin-bottom: 0.5rem; }
    
    .chips { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 0.6rem 0 1rem; }
    .chip { 
      background: #dbeafe; 
      border-radius: 999px; 
      padding: 0.35rem 0.8rem; 
      color: #1e40af; 
      font-weight: 500;
      font-size: 0.9rem;
    }
    
    .info-grid { 
      display: grid; 
      gap: 0.8rem; 
      background: #f8fafc;
      padding: 1.25rem;
      border-radius: 16px;
      border: 1px solid var(--border);
    }
    .info-grid p { margin: 0; }
    
    .list { display: grid; gap: 0.8rem; margin-top: 1rem; }
    .list.compact .list-item { 
      padding: 1rem; 
      border-radius: 16px; 
      background: #f8fafc;
    }

    .app-grid { 
      display: grid; 
      gap: 1rem; 
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
      margin-top: 1rem; 
    }
    .app-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      border-radius: 18px; 
      padding: 1.25rem;
      border: 1px solid var(--border);
    }
    .app-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; }
    
    .app-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: auto; border-top: 1px solid var(--border); padding-top: 1rem; }
    .app-actions button { padding: 0.4rem 0.8rem; font-size: 0.85rem; min-height: auto; }
    
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
    
    .file-input { padding: 0.5rem; background: #ffffff; }
    
    .muted { color: var(--muted); }
    .meta-line { color: var(--muted); font-size: 0.85rem; margin-top: 0.25rem; margin-bottom: 0; }
    .small { margin-top: 1rem; padding: 1rem; }
    .message { margin-top: 1rem; padding: 1rem; background: #eff6ff; color: #1e40af; border-radius: 12px; }

    /* Modal Styles */
    .modal-overlay { 
      position: fixed; 
      top: 0; left: 0; right: 0; bottom: 0; 
      background: rgba(0, 0, 0, 0.7); 
      display: flex; 
      align-items: center; justify-content: center; 
      z-index: 1000; padding: 2rem;
    }
    .modal-card { 
      max-width: 700px; width: 100%; max-height: 85vh; 
      overflow-y: auto; padding: 2rem; 
      background: var(--card); border-radius: 28px;
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .close-btn { 
      background: #fee2e2; border: none; border-radius: 8px; 
      padding: 0.4rem 1rem; cursor: pointer; font-size: 0.95rem; 
      font-weight: 500; color: #991b1b; transition: all 0.2s; 
    }
    .close-btn:hover { background: #fecaca; }
    .modal-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
    .modal-section p { margin-bottom: 0.5rem; }
    .description-text { white-space: pre-wrap; color: var(--muted); }

    @media (max-width: 980px) {
      .profile-layout,
      .grid { grid-template-columns: 1fr; }
    }
  `],
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly isSeeker = computed(() => this.auth.role() === 'seeker');
  readonly editMode = signal(false);
  readonly activeTab = signal<'profile' | 'applications'>('profile');
  readonly applicationsLoading = signal(false);
  readonly message = signal('');

  readonly skills = signal<SeekerSkill[]>([]);
  readonly resumes = signal<ResumeItem[]>([]);
  readonly applications = signal<ApplicationItem[]>([]);
  readonly viewingJob = signal<JobDetails | null>(null);

  readonly seeker = {
    first_name: '',
    last_name: '',
    phone: '',
    current_title: '',
    summary: '',
    github_url: '',
    linkedin_url: '',
  };

  readonly recruiter = {
    company_name: '',
    company_size: '',
    industry: '',
    hq_location: '',
    website_url: '',
  };

  readonly skill = {
    skill_name: '',
    years_of_experience: 1,
  };

  resumeTitle = '';
  private selectedResumeFile: File | null = null;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    if (this.isSeeker()) {
      this.loadSeeker();
      this.loadSkills();
      this.loadResumes();
      this.loadApplications();
    } else {
      this.loadRecruiter();
    }
  }

  protected loadSeeker(): void {
    this.api.get(`${this.api.profileBase}/seeker/`, true).subscribe({
      next: (response) => {
        Object.assign(this.seeker, response as object);
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected saveSeeker(): void {
    this.api.post(`${this.api.profileBase}/seeker/`, this.seeker, true).subscribe({
      next: () => {
        this.message.set('Seeker profile saved.');
        this.editMode.set(false);
      },
      error: () => {
        this.api.patch(`${this.api.profileBase}/seeker/`, this.seeker, true).subscribe({
          next: () => {
            this.message.set('Seeker profile updated.');
            this.editMode.set(false);
          },
          error: (error) => this.message.set(this.errorMessage(error)),
        });
      },
    });
  }

  protected loadRecruiter(): void {
    this.api.get(`${this.api.profileBase}/recruiter/`, true).subscribe({
      next: (response) => {
        Object.assign(this.recruiter, response as object);
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected saveRecruiter(): void {
    this.api.post(`${this.api.profileBase}/recruiter/`, this.recruiter, true).subscribe({
      next: () => {
        this.message.set('Recruiter profile saved.');
        this.editMode.set(false);
      },
      error: () => {
        this.api.patch(`${this.api.profileBase}/recruiter/`, this.recruiter, true).subscribe({
          next: () => {
            this.message.set('Recruiter profile updated.');
            this.editMode.set(false);
          },
          error: (error) => this.message.set(this.errorMessage(error)),
        });
      },
    });
  }

  protected loadSkills(): void {
    this.api.get<SeekerSkill[]>(`${this.api.profileBase}/seeker/skills/`, true).subscribe({
      next: (res) => this.skills.set(res),
      error: () => undefined,
    });
  }

  protected addSkill(): void {
    if (!this.skill.skill_name.trim()) {
      this.message.set('Enter a skill name first.');
      return;
    }
    this.api.post(`${this.api.profileBase}/seeker/skills/`, this.skill, true).subscribe({
      next: () => {
        this.message.set('Skill saved.');
        this.skill.skill_name = '';
        this.skill.years_of_experience = 1;
        this.loadSkills();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected loadResumes(): void {
    this.api.get<ResumeItem[]>(`${this.api.profileBase}/seeker/resumes/`, true).subscribe({
      next: (res) => this.resumes.set(res),
      error: () => undefined,
    });
  }

  protected onResumeSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedResumeFile = target.files?.[0] ?? null;
  }

  protected uploadResume(): void {
    if (!this.selectedResumeFile) {
      this.message.set('Select a resume PDF first.');
      return;
    }
    const form = new FormData();
    form.append('resume', this.selectedResumeFile);
    form.append('resume_title', this.resumeTitle || this.selectedResumeFile.name);

    this.api.postForm(`${this.api.profileBase}/seeker/resumes/`, form, true).subscribe({
      next: () => {
        this.message.set('Resume uploaded successfully. It is currently being processed.');
        this.resumeTitle = '';
        this.selectedResumeFile = null;
        this.loadResumes();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected loadApplications(): void {
    this.applicationsLoading.set(true);
    this.api.get<ApplicationItem[]>(`${this.api.applicationsBase}/my/`, true).subscribe({
      next: (res) => {
        this.applications.set(res);
        this.applicationsLoading.set(false);
      },
      error: () => {
        this.applicationsLoading.set(false);
      },
    });
  }

  protected viewJobDetails(jobId: string): void {
    this.message.set('');
    this.api.get<JobDetails>(`${this.api.jobsBase}/${jobId}/`, true).subscribe({
      next: (job) => {
        this.viewingJob.set(job);
      },
      error: (error) => {
        this.message.set('Could not load job details. The job may have been removed.');
      },
    });
  }

  protected viewResume(resumeId: string): void {
    this.message.set('Loading resume securely...');
    
    this.api.getBlob(`${this.api.profileBase}/seeker/resumes/${resumeId}/download/`, true).subscribe({
      next: (blob) => {
        this.message.set('');
        const fileUrl = window.URL.createObjectURL(blob);
        window.open(fileUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(fileUrl), 10000);
      },
      error: (error) => {
        console.error(error);
        this.message.set('Failed to load resume file.');
      },
    });
  }

  protected formatSalary(min: number | null, max: number | null): string {
    if (!min && !max) return 'Not disclosed';
    return `INR ${min ?? 0} - ${max ?? 0}`;
  }

  private errorMessage(error: { error?: unknown; message?: string }): string {
    if (typeof error.error === 'string') return error.error;
    if (error.error) {
      if (typeof error.error === 'object' && 'detail' in error.error) return error.error.detail as string;
      return JSON.stringify(error.error, null, 2);
    }
    return error.message ?? 'Request failed';
  }
}