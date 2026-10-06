import { Injectable, isDevMode, signal } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

export type AdminLoginResult = { ok: true } | { ok: false; reason: string };

const ADMIN_KEY = 'maks.admin';

/**
 * Admin sign-in is NOT connected to a server yet. While you run `ng serve` (development
 * mode) login() lets any username and password in so you can preview the admin pages. In a
 * production build (`ng build`) it always fails until you replace it. There are deliberately
 * no admin credentials in this front-end code: anything shipped to the browser can be read
 * by anyone.
 *
 * TODO (API): POST the username and password to your backend over HTTPS. The server
 * must check them (hashed passwords), rate-limit or lock out repeated failures, ideally
 * require a second factor, and answer with a session cookie (httpOnly) or token. Return
 * { ok: true } on success, or { ok: false, reason } with a generic message such as
 * "Invalid username or password" (never say which one was wrong). Every admin API call
 * must be authorised again on the server; this page and the route guard only hide the UI.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  readonly admin = signal<{ username: string } | null>(this.read());

  login(username: string, _password: string): Observable<AdminLoginResult> {
    void username;
    // TODO: remove this development shortcut when the real login is connected.
    if (isDevMode()) {
      return of<AdminLoginResult>({ ok: true }).pipe(delay(300));
    }
    return of<AdminLoginResult>({
      ok: false,
      reason: 'Admin sign-in is not connected to the server yet.',
    }).pipe(delay(500));
  }

  /** Call this once the server has accepted the login. */
  startSession(username: string): void {
    this.admin.set({ username });
    try {
      sessionStorage.setItem(ADMIN_KEY, JSON.stringify({ username }));
    } catch {
      /* storage unavailable */
    }
  }

  signOut(): void {
    try {
      sessionStorage.removeItem(ADMIN_KEY);
    } catch {
      /* storage unavailable */
    }
    this.admin.set(null);
  }

  private read(): { username: string } | null {
    try {
      const raw = sessionStorage.getItem(ADMIN_KEY);
      return raw ? (JSON.parse(raw) as { username: string }) : null;
    } catch {
      return null;
    }
  }
}
