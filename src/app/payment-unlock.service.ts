import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_URL } from './api.config';

export type UnlockResult = { ok: true } | { ok: false; reason: string };

/**
 * Payment Settings is protected by the carpenter's password. The server re-checks it; a successful
 * check lets ONE navigation to /payment-details through (kept in memory only, never stored).
 */
@Injectable({ providedIn: 'root' })
export class PaymentUnlockService {
  private readonly http = inject(HttpClient);
  private unlockedOnce = false;

  verify(password: string): Observable<UnlockResult> {
    return this.http.post(`${API_URL}/carpenter/verify-password`, { password }).pipe(
      map((): UnlockResult => {
        this.unlockedOnce = true;
        return { ok: true };
      }),
      catchError((err: HttpErrorResponse) => of<UnlockResult>({ ok: false, reason: this.reason(err) })),
    );
  }

  /** True once after a correct password. */
  consume(): boolean {
    const ok = this.unlockedOnce;
    this.unlockedOnce = false;
    return ok;
  }

  private reason(err: HttpErrorResponse): string {
    if (err.status === 0) return 'Cannot reach the server. Please check that the API is running.';
    if (err.status === 423) return 'Too many attempts. Please try again in a few minutes.';
    if (err.status === 400) return 'Incorrect password.';
    return 'Something went wrong. Please try again.';
  }
}
