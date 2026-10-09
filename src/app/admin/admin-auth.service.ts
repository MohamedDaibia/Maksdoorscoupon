import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_URL } from '../api.config';

export type AdminLoginResult = { ok: true } | { ok: false; reason: string };

export interface AdminSession {
  username: string;
  name: string;
  token: string;
  expiresAt: string; // ISO date-time, from the server
}

interface LoginResponse {
  token: string;
  expiresAtUtc: string;
  name: string;
  roles: string[];
}

const ADMIN_KEY = 'maks.admin';

/**
 * Admin / Employee sign-in against the API (POST /api/admin/auth/login). The server checks
 * the password and the role; the token it returns is sent with every admin request by the
 * auth interceptor. The token lives in sessionStorage, so it is gone when the tab closes.
 * Every admin API call is checked again on the server; the route guard only hides the UI.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);

  readonly admin = signal<AdminSession | null>(this.read());

  /** The token to send to the API, or null when signed out or expired. */
  token(): string | null {
    const s = this.admin();
    return s && this.isLive(s) ? s.token : null;
  }

  /** True while there is a signed-in admin whose token has not expired. */
  isSignedIn(): boolean {
    const s = this.admin();
    if (s && !this.isLive(s)) {
      this.signOut();
      return false;
    }
    return s !== null;
  }

  login(username: string, password: string): Observable<AdminLoginResult> {
    return this.http
      .post<LoginResponse>(`${API_URL}/admin/auth/login`, { userName: username.trim(), password })
      .pipe(
        map((res): AdminLoginResult => {
          this.startSession({
            username: username.trim(),
            name: res.name,
            token: res.token,
            expiresAt: res.expiresAtUtc,
          });
          return { ok: true };
        }),
        catchError((err: HttpErrorResponse) => of<AdminLoginResult>({ ok: false, reason: this.reason(err) })),
      );
  }

  signOut(): void {
    try {
      sessionStorage.removeItem(ADMIN_KEY);
    } catch {
      /* storage unavailable */
    }
    this.admin.set(null);
  }

  private startSession(session: AdminSession): void {
    this.admin.set(session);
    try {
      sessionStorage.setItem(ADMIN_KEY, JSON.stringify(session));
    } catch {
      /* storage unavailable: the session still works until the page is reloaded */
    }
  }

  private reason(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Cannot reach the server. Please check that the API is running.';
    }
    if (err.status === 423) {
      return 'Too many attempts. Please try again in a few minutes.';
    }
    if (err.status === 401) {
      return 'Invalid username or password.';
    }
    return 'Something went wrong. Please try again.';
  }

  private isLive(s: AdminSession): boolean {
    return new Date(s.expiresAt).getTime() > Date.now();
  }

  private read(): AdminSession | null {
    try {
      const raw = sessionStorage.getItem(ADMIN_KEY);
      if (!raw) {
        return null;
      }
      const s = JSON.parse(raw) as AdminSession;
      return s.token && this.isLive(s) ? s : null;
    } catch {
      return null;
    }
  }
}
