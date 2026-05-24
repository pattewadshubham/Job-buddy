import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);

  readonly authBase = '/api/auth';
  readonly profileBase = '/api/profile';
  readonly jobsBase = '/api/jobs';
  readonly applicationsBase = '/api/applications';
  readonly matchBase = '/api/match';
  readonly notificationsBase = '/api/notifications';
  readonly chatBase = '/api/chat';

  get<T>(url: string, auth = false): Observable<T> {
    return this.http.get<T>(url, { headers: this.headers(auth) });
  }

  getBlob(url: string, auth = false): Observable<Blob> {
    // We cast responseType to 'json' to satisfy TypeScript's overload signatures, 
    // but pass 'blob' so HttpClient knows to parse a file.
    return this.http.get(url, { headers: this.headers(auth), responseType: 'blob' as 'json' }) as Observable<Blob>;
  }

  post<T>(url: string, body: unknown, auth = false): Observable<T> {
    return this.http.post<T>(url, body, { headers: this.headers(auth) });
  }

  postForm<T>(url: string, body: FormData, auth = false): Observable<T> {
    return this.http.post<T>(url, body, { headers: this.formHeaders(auth) });
  }

  patch<T>(url: string, body: unknown, auth = false): Observable<T> {
    return this.http.patch<T>(url, body, { headers: this.headers(auth) });
  }

  private headers(auth: boolean): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    if (auth && this.authState.accessToken()) {
      headers = headers.set('Authorization', `Bearer ${this.authState.accessToken()}`);
    }

    return headers;
  }

  private formHeaders(auth: boolean): HttpHeaders {
    let headers = new HttpHeaders();
    if (auth && this.authState.accessToken()) {
      headers = headers.set('Authorization', `Bearer ${this.authState.accessToken()}`);
    }
    return headers;
  }
}
