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
const CARPENTERS_KEY = 'maks.carpenters'; // localStorage: everyone who registered

/**
 * DEMO ONLY: the signed-in user lives in sessionStorage and the registered carpenters in
 * localStorage, so the signup, sign-in and admin pages work before a backend exists.
 * Replace with real authentication and API calls later. Passwords are never stored here.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly user = signal<UserProfile | null>(this.readUser());
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

  signIn(phone: string): void {
    const found = this.carpenters().find((c) => c.phone === phone);
    const profile: UserProfile = found
      ? { name: found.name, phone: found.phone, photoUrl: found.photoUrl }
      : { name: 'Member', phone, photoUrl: null };
    try {
      sessionStorage.setItem(USER_KEY, JSON.stringify(profile));
    } catch {
      /* storage unavailable */
    }
    this.user.set(profile);
  }

  signOut(): void {
    try {
      sessionStorage.removeItem(USER_KEY);
    } catch {
      /* storage unavailable */
    }
    this.user.set(null);
  }

  private readUser(): UserProfile | null {
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
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
