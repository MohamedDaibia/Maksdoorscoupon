import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from '../../api.config';

export interface AdminCarpenter {
  name: string;
  phone: string;
  state: string | null;
  district: string | null;
  postalCode: string | null;
  photoUrl: string | null;
  registeredAt: string; // ISO date-time
}

export interface CarpenterClaim {
  code: string;
  value: number;
  claimedAt: string;
  status: 'Pending' | 'Paid';
  paidVia: string | null;
  paidAt: string | null;
}

export interface CarpenterPaymentSettings {
  accountNumber: string | null;
  accountHolderName: string | null;
  branch: string | null;
  ifscCode: string | null;
  upiId: string | null;
  googlePayNumber: string | null;
  phonePeNumber: string | null;
}

interface CarpenterDto {
  name: string;
  phone: string;
  state: string | null;
  district: string | null;
  postalCode: string | null;
  photoPath: string | null;
  registeredAt: string;
}

interface PagedDto {
  items: CarpenterDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Admin: the registered carpenters, one page at a time from GET /api/admin/carpenters. */
@Injectable({ providedIn: 'root' })
export class AdminCarpentersService {
  private readonly http = inject(HttpClient);

  /** The carpenters on the current page. */
  readonly carpenters = signal<AdminCarpenter[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  private seq = 0;

  /** Asks the server for one page. "search" matches name, phone or district on the server. */
  load(search = '', page = 1, pageSize = this.pageSize()): void {
    const mine = ++this.seq; // ignore a slow answer that arrives after a newer request
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<PagedDto>(`${API_URL}/admin/carpenters`, { params: { search: search.trim(), page, pageSize } })
      .subscribe({
        next: (res) => {
          if (mine !== this.seq) return;
          this.carpenters.set(res.items.map((c) => this.toCarpenter(c)));
          this.page.set(res.page);
          this.pageSize.set(res.pageSize);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          if (mine !== this.seq) return;
          this.error.set(
            err.status === 0
              ? 'Cannot reach the server. Please check that the API is running.'
              : err.status === 403
                ? 'You do not have permission to view carpenters.'
                : 'Could not load the carpenters.',
          );
          this.loading.set(false);
        },
      });
  }

  /** The carpenters with these phone numbers, to show a name and address next to a claim. */
  findByPhones(phones: string[]): Observable<AdminCarpenter[]> {
    return this.http
      .get<CarpenterDto[]>(`${API_URL}/admin/carpenters/lookup`, { params: { phones } })
      .pipe(map((list) => list.map((c) => this.toCarpenter(c))));
  }

  /** The coupons this carpenter has claimed. Asked for only when their row is opened. */
  claims(phone: string): Observable<CarpenterClaim[]> {
    return this.http.get<CarpenterClaim[]>(`${API_URL}/admin/carpenters/${encodeURIComponent(phone)}/claims`);
  }

  /** How this carpenter wants to be paid (their saved payment settings). */
  paymentSettings(phone: string): Observable<CarpenterPaymentSettings> {
    return this.http.get<CarpenterPaymentSettings>(
      `${API_URL}/admin/carpenters/${encodeURIComponent(phone)}/payment-settings`,
    );
  }

  private toCarpenter(c: CarpenterDto): AdminCarpenter {
    return {
      name: c.name,
      phone: c.phone,
      state: c.state,
      district: c.district,
      postalCode: c.postalCode,
      photoUrl: this.photoUrl(c.photoPath),
      registeredAt: c.registeredAt,
    };
  }

  /** Photos are served by the API (wwwroot), so build the address from the API's origin. */
  private photoUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }
    const origin = API_URL.startsWith('http') ? new URL(API_URL).origin : '';
    return `${origin}${path}`;
  }
}
