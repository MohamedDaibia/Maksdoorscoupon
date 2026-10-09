import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_URL } from '../api.config';
import { SessionService } from '../session.service';

export type AuthResult = { ok: true } | { ok: false; reason: string };

export interface RegisterInput {
  name: string;
  phone: string;
  password: string;
  state: string;
  district: string;
  postalCode: string;
  photo: File | null;
}

interface AuthResponse {
  token: string;
  expiresAtUtc: string;
  name: string;
  roles: string[];
  photoPath: string | null;
}

/**
 * Carpenter sign-up and sign-in against the API (POST /api/auth/register and /api/auth/login).
 * The server checks the password; the token it returns is kept by SessionService and sent with
 * carpenter API calls by the interceptor.
 */
@Injectable({ providedIn: 'root' })
export class CarpenterAuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  login(phone: string, password: string): Observable<AuthResult> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { phone: phone.trim(), password }).pipe(
      map((res) => this.start(res, phone.trim())),
      catchError((err: HttpErrorResponse) => of<AuthResult>({ ok: false, reason: this.reason(err, 'login') })),
    );
  }

  /** Sends the sign-up as multipart/form-data (the photo is a file). Signs the carpenter in on success. */
  register(input: RegisterInput): Observable<AuthResult> {
    const body = new FormData();
    body.append('Name', input.name.trim());
    body.append('Phone', input.phone.trim());
    body.append('Password', input.password);
    body.append('State', input.state);
    body.append('District', input.district);
    body.append('PostalCode', input.postalCode.trim());
    if (input.photo) {
      body.append('Photo', input.photo, input.photo.name);
    }
    // No Content-Type header here: the browser adds it, with the multipart boundary.
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, body).pipe(
      map((res) => this.start(res, input.phone.trim())),
      catchError((err: HttpErrorResponse) => of<AuthResult>({ ok: false, reason: this.reason(err, 'register') })),
    );
  }

  private start(res: AuthResponse, phone: string): AuthResult {
    this.session.signIn({
      profile: { name: res.name, phone, photoUrl: this.photoUrl(res.photoPath) },
      token: res.token,
      expiresAt: res.expiresAtUtc,
    });
    return { ok: true };
  }

  /** Photos are served by the API (wwwroot), so build the address from the API's origin. */
  private photoUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }
    const origin = API_URL.startsWith('http') ? new URL(API_URL).origin : '';
    return `${origin}${path}`;
  }

  private reason(err: HttpErrorResponse, kind: 'login' | 'register'): string {
    if (err.status === 0) {
      return 'Cannot reach the server. Please check that the API is running.';
    }
    if (err.status === 423) {
      return 'Too many attempts. Please try again in a few minutes.';
    }
    if (err.status === 401) {
      return 'Invalid phone number or password.';
    }
    if (kind === 'register' && err.status === 400) {
      const first = err.error?.errors && typeof err.error.errors === 'object'
        ? (Object.values(err.error.errors).flat() as string[])[0]
        : err.error?.error;
      return typeof first === 'string' && first ? first : 'Please check your details and try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
