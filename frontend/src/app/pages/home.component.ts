import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

interface Job {
  id: string;
  title: string;
  description: string;
  location_type: string;
  location_city: string;
  experience_required: string;
  salary_min: number | null;
  salary_max: number | null;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="hero-card">
      <div>
        <p class="eyebrow">Microservice job portal</p>
        <h1>Find work. Post roles. Manage profiles.</h1>
        <p class="lead">
          Job Buddy connects seekers and recruiters through separate auth, job, and profile
          services behind one Angular frontend.
        </p>
        <div class="hero-actions">
          <a routerLink="/jobs" class="btn-primary">Browse Jobs</a>
          
          @if (!auth.isLoggedIn()) {
            <a routerLink="/login" class="btn-secondary">Login / Register</a>
          }
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Featured openings</p>
          <h2>Published jobs from the Job Service</h2>
        </div>
        <a routerLink="/jobs" class="inline-link">See all jobs</a>
      </div>

      @if (loading()) {
        <div class="empty-card">Loading jobs...</div>
      } @else if (error()) {
        <div class="empty-card error">{{ error() }}</div>
      } @else if (!jobs().length) {
        <div class="empty-card">No published jobs found. Publish one from the recruiter account.</div>
      } @else {
        <div class="job-grid">
          @for (job of jobs(); track job.id) {
            <article class="job-card">
              <p class="job-meta">{{ job.location_type }} @if (job.location_city) { . {{ job.location_city }} }</p>
              <h3>{{ job.title }}</h3>
              <p>{{ job.description }}</p>
              <div class="job-footer">
                <span>{{ job.experience_required || 'Experience not specified' }}</span>
                <span>{{ formatSalary(job.salary_min, job.salary_max) }}</span>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .hero-card,
    .job-card,
    .empty-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .hero-card {
      display: grid;
      gap: 1.5rem;
      grid-template-columns: 1.2fr 0.8fr;
      margin-bottom: 1.6rem;
      padding: 2rem;
    }
    h1 {
      font-size: clamp(2.8rem, 6vw, 4.8rem);
      line-height: 0.95;
      margin: 0.3rem 0 1rem;
    }
    .lead,
    .job-card p {
      color: var(--muted);
    }
    .hero-actions,
    .job-footer,
    .section-heading {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .empty-card {
      background: rgba(255, 255, 255, 0.62);
      border-radius: 22px;
      padding: 1.25rem;
    }
    .section {
      display: grid;
      gap: 1rem;
    }
    .job-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .job-card {
      display: grid;
      gap: 0.8rem;
      padding: 1.25rem;
    }
    .job-meta {
      color: var(--accent);
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .error {
      color: #9f2f18;
    }
    @media (max-width: 980px) {
      .hero-card,
      .job-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class HomeComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly jobs = signal<Job[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.api.get<Job[]>(`${this.api.jobsBase}/`).subscribe({
      next: (jobs) => {
        this.jobs.set(jobs.slice(0, 6));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Job service is not reachable. Start the backend services and refresh.');
        this.loading.set(false);
      },
    });
  }

  protected formatSalary(min: number | null, max: number | null): string {
    if (min == null && max == null) {
      return 'Salary not disclosed';
    }
    if (min != null && max != null) {
      return `INR ${min} - ${max}`;
    }
    if (min != null) {
      return `From INR ${min}`;
    }
    return `Up to INR ${max}`;
  }
}