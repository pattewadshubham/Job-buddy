import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

interface MatchResponse<T> {
  results: T[];
}

interface JobMatch {
  job_id: string;
  similarity_score: number;
}

interface SeekerMatch {
  seeker_id: string;
  resume_id: string;
  similarity_score: number;
  seeker_email?: string;
  application_id?: string;
  current_stage?: string;
  first_name?: string;
  last_name?: string;
}

interface SeekerProfile {
  id: string;
  user_id: string;
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

interface InterviewResponse {
  id: string;
  scheduled_at: string;
  expires_at: string;
  jitsi_link: string;
  recruiter_notes: string;
  is_expired: boolean;
}

interface JobSummary {
  id: string;
  title: string;
}

interface JobMatchView {
  job_id: string;
  title: string;
  similarity_score: number;
  description?: string;
  location_type?: string;
  location_city?: string;
  experience_required?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  status?: string;
}

interface ResumeItem {
  id: string;
  resume_title: string;
  parsing_status: string;
  is_primary?: boolean;
}

interface ApplicationItem {
  id: string;
  job_id: string;
  current_stage: string;
}

@Component({
  selector: 'app-matches-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Matching service</p>
          <h1>AI match explorer</h1>
        </div>
      </div>

      @if (isSeeker()) {
        <p class="hint">Shows top matched jobs for your seeker account.</p>
        <button type="button" (click)="loadJobsForSeeker()">Find jobs for me</button>

        @if (auth.isLoggedIn()) {
          <div class="apply-bar" style="margin-top: 1rem; margin-bottom: 1rem; background: rgba(10, 16, 32, 0.05); border: 1px solid var(--border); border-radius: 18px; padding: 1rem;">
            <label style="display: grid; gap: 0.25rem;">
              <span>Resume to use for apply</span>
              <select [(ngModel)]="selectedResumeId">
                <option value="">Select resume</option>
                @for (resume of resumes(); track resume.id) {
                  <option [value]="resume.id">{{ resume.resume_title }} ({{ resume.parsing_status }})</option>
                }
              </select>
            </label>
          </div>
        }

        @if (jobResults().length) {
          <div class="list">
            @for (item of jobResults(); track item.job_id) {
              <article class="item">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                  <div>
                    <p class="eyebrow" style="margin: 0; color: var(--muted); font-size: 0.85rem; text-transform: uppercase;">{{ item.location_type || 'Location N/A' }} @if (item.location_city) { · {{ item.location_city }} }</p>
                    <h2 style="margin: 0.25rem 0;">{{ item.title }}</h2>
                    <p class="muted" style="margin: 0; font-size: 0.85rem;">Job ID: {{ item.job_id }}</p>
                  </div>
                  <span class="status-pill" style="background: rgba(42, 157, 143, 0.16); color: #9fe3d8;">Match score: {{ item.similarity_score }}</span>
                </div>
                
                @if (item.description) {
                  <p class="description" style="color: var(--muted); margin: 1rem 0;">{{ item.description.length > 200 ? (item.description | slice:0:200) + '...' : item.description }}</p>
                }
                
                <div style="display: flex; gap: 1rem; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap;">
                  <span>{{ item.experience_required || 'Experience not specified' }}</span>
                  <span>{{ formatSalary(item.salary_min, item.salary_max) }}</span>
                </div>

                @if (auth.isLoggedIn()) {
                  <div style="display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                    @if (appliedJobIds().has(item.job_id)) {
                      <span style="background: rgba(30, 111, 104, 0.14); color: #1e6f68; border-radius: 999px; padding: 0.45rem 0.8rem;">Already applied</span>
                    } @else {
                      <button type="button" (click)="apply(item.job_id)">Apply now</button>
                    }
                  </div>
                }
              </article>
            }
          </div>
        }
      } @else {
        <div class="controls">
          <label>
            <span>Select job</span>
            <select [(ngModel)]="jobId">
              <option value="">Select job</option>
              @for (job of recruiterJobs(); track job.id) {
                <option [value]="job.id">{{ job.title }} ({{ job.id }})</option>
              }
            </select>
          </label>
          <button type="button" (click)="loadSeekersForJob()">Find matching seekers</button>
        </div>

        @if (seekerResults().length) {
          <div class="applicant-list">
            @for (item of seekerResults(); track item.resume_id) {
              <article class="applicant-card">
                <div class="applicant-header">
                  <div class="applicant-info">
                    <h3>
                      @if (item.first_name) {
                        {{ item.first_name }} {{ item.last_name }}
                      } @else {
                        {{ item.seeker_email || item.seeker_id }}
                      }
                    </h3>
                    <p class="meta-line">Match score: {{ item.similarity_score }}</p>
                  </div>
                  @if (item.current_stage) {
                    <span class="status-pill">{{ item.current_stage }}</span>
                  }
                </div>

                <div class="applicant-actions">
                  <button type="button" class="secondary" (click)="viewProfile(item.seeker_id)">Profile</button>

                  @if (item.resume_id) {
                    <button type="button" class="secondary" (click)="viewResume(item.resume_id)">View Resume</button>
                  }

                  <button type="button" class="secondary" (click)="toggleSchedule(item.seeker_id)">
                    {{ schedulingSeekerId() === item.seeker_id ? 'Cancel' : 'Schedule' }}
                  </button>
                </div>

                @if (schedulingSeekerId() === item.seeker_id) {
                  <div class="schedule-form">
                    @if (!item.application_id) {
                      <p class="error-text">Seeker must apply before you can schedule.</p>
                    } @else {
                      <label>
                        <span>Date and time</span>
                        <input [(ngModel)]="scheduleDateTime" type="datetime-local" />
                      </label>
                      <label>
                        <span>Recruiter notes</span>
                        <textarea [(ngModel)]="scheduleNotes" rows="2"></textarea>
                      </label>
                      <button type="button" (click)="scheduleInterview(item)">Generate interview link</button>
                    }
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

      @if (scheduledInterview(); as interview) {
        <article class="interview-banner">
          <h3>Latest interview scheduled</h3>
          <p><strong>Time:</strong> {{ interview.scheduled_at | date: 'medium' }}</p>
          <p><strong>Link:</strong> <a [href]="interview.jitsi_link" target="_blank" rel="noreferrer">{{ interview.jitsi_link }}</a></p>
          <p><strong>Notes:</strong> {{ interview.recruiter_notes || 'None' }}</p>
        </article>
      }

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

      @if (message()) {
        <div class="empty-card">{{ message() }}</div>
      }

      @if (error()) {
        <div class="empty-card error">{{ error() }}</div>
      }
    </section>
  `,
  styles: [`
    .page-card,
    .empty-card,
    .item,
    .modal-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card { display: grid; gap: 1rem; padding: 1.5rem; }
    .list { display: grid; gap: 1rem; }
    .item { padding: 1rem 1.2rem; }
    .hint,
    .muted { color: var(--muted); }
    .error { color: #ffb8aa; }
    
    .controls { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem; }
    .controls label { display: grid; gap: 0.25rem; }
    
    .applicant-list { display: grid; gap: 1rem; margin-top: 1rem; }
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
    .applicant-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    
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
    
    .meta-line { margin: 0; color: var(--muted); font-size: 0.9rem; }
    
    .schedule-form { 
      display: grid; 
      gap: 1rem; 
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 12px;
    }
    
    .error-text { color: #ef4444; font-size: 0.9rem; margin: 0; }
    
    .message { margin-top: 1rem; padding: 1rem; color: var(--accent); }
    
    .interview-banner { 
      background: #ecfdf5; 
      border: 1px solid #6ee7b7;
      border-radius: 18px; 
      padding: 1.25rem;
      margin-top: 1rem;
      color: #065f46;
    }
    
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

    @media (max-width: 768px) {
      .modal-overlay { padding: 1rem; }
      .controls { flex-direction: column; align-items: stretch; }
    }
  `],
})
export class MatchesComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly isSeeker = computed(() => this.auth.role() === 'seeker');
  readonly recruiterJobs = signal<JobSummary[]>([]);

  readonly jobResults = signal<JobMatchView[]>([]);
  readonly seekerResults = signal<SeekerMatch[]>([]);
  readonly error = signal('');
  readonly message = signal('');
  readonly interviewMessage = signal('');

  readonly viewingProfile = signal<SeekerProfile | null>(null);
  readonly schedulingSeekerId = signal('');
  readonly scheduledInterview = signal<InterviewResponse | null>(null);

  readonly resumes = signal<ResumeItem[]>([]);
  readonly appliedJobIds = signal<Set<string>>(new Set<string>());
  selectedResumeId = '';

  jobId = '';
  scheduleDateTime = '';
  scheduleNotes = '';

  ngOnInit(): void {
    if (!this.isSeeker() && this.auth.isLoggedIn()) {
      this.api.get<JobSummary[]>(`${this.api.jobsBase}/my/`, true).subscribe({
        next: (jobs) => this.recruiterJobs.set(jobs),
      });
    }
    if (this.isSeeker() && this.auth.isLoggedIn()) {
      this.loadResumes();
      this.loadApplications();
    }
  }

  private loadResumes(): void {
    this.api.get<ResumeItem[]>(`${this.api.profileBase}/seeker/resumes/`, true).subscribe({
      next: (resumes) => {
        this.resumes.set(resumes);
        if (resumes.length) {
          const primaryResume = resumes.find(r => r.is_primary);
          this.selectedResumeId = primaryResume ? primaryResume.id : resumes[0].id;
        }
      },
    });
  }

  private loadApplications(): void {
    this.api.get<ApplicationItem[]>(`${this.api.applicationsBase}/my/`, true).subscribe({
      next: (apps) => this.appliedJobIds.set(new Set(apps.map((app) => app.job_id))),
    });
  }

  protected apply(jobId: string): void {
    this.message.set('');
    if (!this.selectedResumeId) {
      this.message.set('Select a resume first from the dropdown above.');
      return;
    }

    this.api.post(`${this.api.applicationsBase}/apply/`, {
      job_id: jobId,
      resume_id: this.selectedResumeId,
      cover_letter: 'Applied via AI Matches.',
    }, true).subscribe({
      next: () => {
        this.message.set('Application submitted.');
        this.loadApplications();
      },
      error: (error) => {
        if (error?.error && typeof error.error === 'object') {
          this.message.set(JSON.stringify(error.error));
        } else {
          this.message.set('Unable to apply for this job.');
        }
      },
    });
  }

  protected formatSalary(min: number | null | undefined, max: number | null | undefined): string {
    if (!min && !max) return 'Salary not disclosed';
    return `INR ${min ?? 0} - ${max ?? 0}`;
  }

  protected loadJobsForSeeker(): void {
    this.error.set('');
    this.message.set('');
    const seekerId = this.auth.userId();
    
    // Attempt to use the selected or primary resume for matching, otherwise let the backend fallback
    const resumesList = this.resumes();
    const matchResume = resumesList.find(r => r.is_primary) || resumesList[0];
    const resumeQuery = matchResume ? `?resume_id=${matchResume.id}` : '';

    this.api.get<MatchResponse<JobMatch>>(`${this.api.matchBase}/jobs-for-seeker/${seekerId}/${resumeQuery}`, true).subscribe({
      next: (res) => {
        const results = res.results ?? [];
        if (!results.length) {
          this.jobResults.set([]);
          this.message.set('No matches yet. Upload resume and ensure a recruiter published jobs.');
          return;
        }

        const detailCalls = results.map((item) =>
          this.api.get<any>(`${this.api.jobsBase}/${item.job_id}/`).pipe(
            map((job) => ({ 
              job_id: item.job_id, 
              title: job.title || item.job_id, 
              similarity_score: item.similarity_score,
              description: job.description,
              location_type: job.location_type,
              location_city: job.location_city,
              experience_required: job.experience_required,
              salary_min: job.salary_min,
              salary_max: job.salary_max,
              status: job.status
            })),
            catchError(() => of({ job_id: item.job_id, title: item.job_id, similarity_score: item.similarity_score })),
          ),
        );

        forkJoin(detailCalls).subscribe({
          next: (rows) => this.jobResults.set(rows),
          error: () => this.error.set('Unable to resolve job details for match results.'),
        });
      },
      error: () => this.error.set('Unable to fetch seeker matches from matching service.'),
    });
  }

  protected loadSeekersForJob(): void {
    this.error.set('');
    this.message.set('');
    if (!this.jobId.trim()) {
      this.error.set('Select a job first.');
      return;
    }

    const job_id = this.jobId.trim();

    this.api.get<MatchResponse<SeekerMatch>>(`${this.api.matchBase}/seekers-for-job/${job_id}/`, true).subscribe({
      next: (res) => {
        const results = res.results ?? [];
        if (!results.length) {
          this.seekerResults.set([]);
          this.message.set('No seeker matches yet for this job.');
          return;
        }

        // Fetch applications AND profiles in parallel
        const applications$ = this.api.get<Applicant[]>(`${this.api.applicationsBase}/job/${job_id}/`, true).pipe(
          catchError(() => of([] as Applicant[]))
        );

        const profiles$ = forkJoin(
          results.map(match => 
            this.api.get<SeekerProfile>(`${this.api.profileBase}/seeker/${match.seeker_id}/`, true).pipe(
              catchError(() => of(null))
            )
          )
        );

        forkJoin([applications$, profiles$]).subscribe({
          next: ([apps, profiles]) => {
            const seekerResultsEnriched = results.map((match, index) => {
              const profile = profiles[index];
              // matching_service seeker_id could be profile PK. application_service uses user ID.
              // profile service now handles both, returning the full profile including user_id.
              const appLookupId = profile?.user_id || match.seeker_id;
              const app = apps.find((a) => a.seeker_id === appLookupId);

              return {
                ...match,
                application_id: app?.id,
                seeker_email: app?.seeker_email,
                current_stage: app?.current_stage,
                first_name: profile?.first_name,
                last_name: profile?.last_name,
              };
            });
            this.seekerResults.set(seekerResultsEnriched);
          },
          error: () => {
            this.seekerResults.set(results);
          }
        });
      },
      error: () => this.error.set('Unable to fetch job matches from matching service.'),
    });
  }

  protected viewProfile(seekerId: string): void {
    this.api.get<SeekerProfile>(`${this.api.profileBase}/seeker/${seekerId}/`, true).subscribe({
      next: (profile) => this.viewingProfile.set(profile),
      error: (error) => this.error.set(this.errorMessage(error)),
    });
  }

  protected closeProfile(): void {
    this.viewingProfile.set(null);
  }

  protected viewResume(resumeId: string): void {
    if (!resumeId) {
      this.message.set('No resume found for this seeker.');
      return;
    }

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
        this.error.set('Failed to load resume. You may not have permission.');
      },
    });
  }

  protected toggleSchedule(seekerId: string): void {
    if (this.schedulingSeekerId() === seekerId) {
      this.schedulingSeekerId.set('');
      this.scheduleDateTime = '';
      this.scheduleNotes = '';
      return;
    }
    this.schedulingSeekerId.set(seekerId);
    this.scheduleDateTime = '';
    this.scheduleNotes = '';
    this.interviewMessage.set('');
  }

  protected scheduleInterview(match: SeekerMatch): void {
    if (!match.application_id) {
      this.interviewMessage.set('Cannot schedule: Seeker has not applied yet.');
      return;
    }

    if (!this.scheduleDateTime) {
      this.interviewMessage.set('Pick an interview date and time first.');
      return;
    }

    const scheduledAt = new Date(this.scheduleDateTime);
    if (Number.isNaN(scheduledAt.getTime())) {
      this.interviewMessage.set('Enter a valid interview date and time.');
      return;
    }

    this.api
      .post<InterviewResponse>(
        `${this.api.applicationsBase}/${match.application_id}/schedule-interview/`,
        {
          scheduled_at: scheduledAt.toISOString(),
          recruiter_notes: this.scheduleNotes,
        },
        true
      )
      .subscribe({
        next: (interview) => {
          this.scheduledInterview.set(interview);
          this.interviewMessage.set('Interview scheduled and email notification queued.');
          this.schedulingSeekerId.set('');
          this.scheduleDateTime = '';
          this.scheduleNotes = '';
        },
        error: (error) => this.interviewMessage.set(this.errorMessage(error)),
      });
  }

  private errorMessage(error: { error?: unknown; message?: string }): string {
    if (typeof error.error === 'string') return error.error;
    if (error.error && typeof error.error === 'object') return JSON.stringify(error.error);
    return error.message ?? 'Request failed';
  }
}
