import { Injectable, signal } from '@angular/core';

export interface UserProfile {
  name: string;
  phone: string;
  photoUrl: string | null;
}

export interface Carpenter extends UserProfile {
  state: string;
  district: string;
  postalCode: string;
  registeredAt: string; // ISO date-time
}

const USER_KEY = 'maks.user'; // sessionStorage: who is signed in in this tab
const TOKEN_KEY = 'maks.token'; // sessionStorage: the API login token and when it expires
const CARPENTERS_KEY = 'maks.carpenters'; // localStorage: everyone who registered

interface StoredToken {
  token: string;
  expiresAt: string; // ISO date-time, from the server
}

/**
 * The signed-in carpenter and their API token live in sessionStorage (gone when the tab closes).
 * Sign-in itself happens in CarpenterAuthService. The registered-carpenters list in localStorage
 * is still DEMO ONLY (the admin pages read it) until the admin API provides it.
 * Passwords are never stored here.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly user = signal<UserProfile | null>(this.readUser());
  private stored: StoredToken | null = this.readToken();
  readonly carpenters = signal<Carpenter[]>(this.readCarpenters());

  constructor() {
    // Keep this tab up to date when another tab registers someone.
    window.addEventListener('storage', (e) => {
      if (e.key === CARPENTERS_KEY) {
        this.carpenters.set(this.readCarpenters());
      }
    });
  }

  saveRegistration(carpenter: Carpenter): void {
    const others = this.carpenters().filter((c) => c.phone !== carpenter.phone);
    const list = [carpenter, ...others];
    this.carpenters.set(list);
    try {
      localStorage.setItem(CARPENTERS_KEY, JSON.stringify(list));
    } catch {
      /* storage full or unavailable */
    }
  }

  /** Called after the API accepts a sign-in or sign-up. */
  signIn(session: { profile: UserProfile; token: string; expiresAt: string }): void {
    this.stored = { token: session.token, expiresAt: session.expiresAt };
    try {
      sessionStorage.setItem(USER_KEY, JSON.stringify(session.profile));
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(this.stored));
    } catch {
      /* storage unavailable: the session still works until the page is reloaded */
    }
    this.user.set(session.profile);
  }

  /** The token to send to the API, or null when signed out or expired. */
  token(): string | null {
    if (this.stored && new Date(this.stored.expiresAt).getTime() <= Date.now()) {
      this.signOut();
    }
    return this.stored?.token ?? null;
  }

  signOut(): void {
    try {
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
    this.stored = null;
    this.user.set(null);
  }

  private readUser(): UserProfile | null {
    // Only trust a stored user if there is a live token with it.
    if (!this.readToken()) {
      return null;
    }
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  }

  private readToken(): StoredToken | null {
    try {
      const raw = sessionStorage.getItem(TOKEN_KEY);
      const t = raw ? (JSON.parse(raw) as StoredToken) : null;
      return t?.token && new Date(t.expiresAt).getTime() > Date.now() ? t : null;
    } catch {
      return null;
    }
  }

  private readCarpenters(): Carpenter[] {
    try {
      const raw = localStorage.getItem(CARPENTERS_KEY);
      return raw ? (JSON.parse(raw) as Carpenter[]) : [];
    } catch {
      return [];
    }
  }
}
