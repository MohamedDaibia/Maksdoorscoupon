import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, delay, map, of, tap } from 'rxjs';
import { API_URL } from '../api.config';
import { SessionService } from '../session.service';

export type CouponResult =
  | { valid: true; reward: number }
  | { valid: false; reason: string };

/** How a carpenter was paid. */
export type PaymentType = 'Google Pay' | 'PhonePe' | 'Cash' | 'Bank account' | 'Other';
export const PAYMENT_TYPES: PaymentType[] = ['Google Pay', 'PhonePe', 'Cash', 'Bank account', 'Other'];

/** Where a claim is in its life. New claims start as Pending; your backend moves them on. */
export type ClaimStatus = 'Pending' | 'Paid';

export interface ClaimedCoupon {
  code: string;
  reward: number;
  claimedAt: string; // ISO date-time
  status: ClaimStatus;
  phone: string; // who claimed it
  paidType?: PaymentType; // set when the admin marks it paid
  paidAt?: string; // ISO date-time, set when the admin marks it paid
}

export interface CouponRecord {
  code: string;
  value: number;
  createdAt: string; // ISO date-time
  createdBy?: string; // name of the admin/employee who created it (from the database)
}

/** A coupon as the admin sees it: Available until someone claims it. */
export type CouponState = 'Available' | ClaimStatus;

export interface CouponRow extends CouponRecord {
  status: CouponState;
  claimedByPhone: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  paidType: PaymentType | null;
  paidAt: string | null;
  doorPhotoUrl: string | null; // full address of the door photo the carpenter uploaded when claiming
}

export type MarkPaidResult = { ok: true } | { ok: false; reason: string };

export type AddCouponResult = { ok: true; code: string } | { ok: false; reason: string };

/** What GET /api/admin/coupons returns for each coupon. */
interface AdminCouponDto {
  code: string;
  value: number;
  createdAt: string;
  createdBy: string;
  status: CouponState;
  claimedByPhone: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  paidVia: string | null;
  paidAt: string | null;
  doorPhotoPath: string | null;
}

/** What POST /api/admin/coupons returns. */
interface CouponDto {
  code: string;
  value: number;
  createdAt: string;
  createdBy: string;
}

/** What the paged admin endpoints return. */
interface PagedDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const COUPONS_KEY = 'maks.coupons';
const CLAIMS_KEY = 'maks.claims';
const CODE_PATTERN = /^[A-Z0-9-]{4,20}$/;

/**
 * Creating and listing coupons (admin) uses the API and the database. The rest is
 * DEMO ONLY. Coupons and claims are kept in localStorage so the admin pages and the
 * carpenter pages work together before the backend exists. Replace check(), claim(),
 * addCoupon() and the lists with HttpClient calls to your API. The real server must decide
 * whether a coupon is valid and mark it claimed in one atomic step, own the claim status,
 * return each carpenter only their own claims, limit admin actions to admins, and
 * rate-limit attempts so coupon numbers can't be guessed.
 */
@Injectable({ providedIn: 'root' })
export class CouponService {
  /** Every coupon is worth the same amount (in rupees). */
  static readonly COUPON_VALUE = 100;

  private readonly session = inject(SessionService);
  private readonly http = inject(HttpClient);

  /** Coupons stored in the database (admin view), newest first. Filled by loadAdminCoupons(). */
  readonly dbCoupons = signal<CouponRow[]>([]);
  /** Which tab the list is filtered to on the server: all, unclaimed, unpaid or paid. */
  readonly dbStatus = signal<'all' | 'unclaimed' | 'unpaid' | 'paid'>('all');
  /** Numbers for the boxes at the top of the admin Coupons page, from the whole database. */
  readonly dbSummary = signal({ total: 0, unclaimed: 0, unpaid: 0, paid: 0 });
  readonly dbLoading = signal(false);
  readonly dbError = signal('');
  /** Server-side paging: which page is shown, its size, and how many coupons exist in total. */
  readonly dbPage = signal(1);
  readonly dbPageSize = signal(10);
  readonly dbTotal = signal(0);

  /** Every coupon that exists, newest first. */
  readonly coupons = signal<CouponRecord[]>(this.loadCoupons());

  /** Everyone's claims, newest first. */
  private readonly allClaims = signal<ClaimedCoupon[]>(this.loadClaims());

  /** Only the signed-in carpenter's claims (any status), newest first. */
  readonly myClaimedCoupons = computed(() => {
    const phone = this.session.user()?.phone;
    return this.allClaims().filter((c) => c.phone === phone);
  });

  /** The signed-in carpenter's claims that are still waiting to be paid. */
  readonly myPendingCoupons = computed(() =>
    this.myClaimedCoupons().filter((c) => c.status === 'Pending'),
  );

  /** The signed-in carpenter's claims that have already been paid. */
  readonly myPaidCoupons = computed(() =>
    this.myClaimedCoupons().filter((c) => c.status === 'Paid'),
  );

  /** Sum of everything already paid to the signed-in carpenter. */
  readonly totalEarned = computed(() =>
    this.myPaidCoupons().reduce((sum, c) => sum + c.reward, 0),
  );

  /** Admin: the coupons one carpenter has claimed (from the claims kept in this browser), newest first. */
  claimsOf(phone: string): ClaimedCoupon[] {
    return this.allClaims().filter((c) => c.phone === phone);
  }

  /** Admin: the coupons on the current page, with who claimed each and how it was paid (all from the database). */
  readonly adminCoupons = this.dbCoupons;

  constructor() {
    // Keep this tab up to date when another tab (for example the admin) changes the data.
    window.addEventListener('storage', (e) => {
      if (e.key === COUPONS_KEY) {
        this.coupons.set(this.loadCoupons());
      }
      if (e.key === CLAIMS_KEY) {
        this.allClaims.set(this.loadClaims());
      }
    });
  }

  /** Asks the server whether this coupon number exists in the database, then whether it is still unclaimed. */
  check(code: string): Observable<CouponResult> {
    if (!CODE_PATTERN.test(code)) {
      return of<CouponResult>({
        valid: false,
        reason: 'Coupon numbers use only letters, numbers and hyphens.',
      });
    }
    return this.http
      .get<{ code: string; value: number; claimed: boolean }>(`${API_URL}/carpenter/coupons/check`, { params: { code } })
      .pipe(
        map((dto): CouponResult => {
          if (dto.claimed || this.allClaims().some((c) => c.code === code)) {
            return { valid: false, reason: 'This coupon has already been claimed.' };
          }
          return { valid: true, reward: dto.value };
        }),
        catchError((err: HttpErrorResponse) =>
          of<CouponResult>({
            valid: false,
            reason:
              err.status === 404
                ? 'This coupon number is not correct. Please check and try again.'
                : this.describe(err, 'Could not check the coupon. Please try again.'),
          }),
        ),
      );
  }

  /** Sends the coupon number and the door photo together (multipart) to claim the coupon. */
  claim(code: string, doorPhoto: File | null): Observable<CouponResult> {
    if (!doorPhoto) {
      return of<CouponResult>({
        valid: false,
        reason: 'Please add a photo of the door to claim this coupon.',
      }).pipe(delay(300));
    }
    // The server checks the number again, saves the door photo and writes the CouponClaims row.
    const body = new FormData();
    body.append('code', code);
    body.append('doorPhoto', doorPhoto, doorPhoto.name);
    return this.http.post<{ code: string; value: number }>(`${API_URL}/carpenter/coupons/claim`, body).pipe(
      map((dto): CouponResult => ({ valid: true, reward: dto.value })),
      tap((result) => {
        // Keep the local copy the admin pages still read (until they read claims from the API).
        const phone = this.session.user()?.phone;
        if (result.valid && phone) {
          const entry: ClaimedCoupon = {
            code,
            reward: result.reward,
            claimedAt: new Date().toISOString(),
            status: 'Pending',
            phone,
          };
          this.allClaims.update((list) => [entry, ...list]);
          this.write(CLAIMS_KEY, this.allClaims());
        }
      }),
      catchError((err: HttpErrorResponse) =>
        of<CouponResult>({
          valid: false,
          reason:
            err.status === 409
              ? 'This coupon has already been claimed.'
              : this.describe(err, 'Could not claim the coupon. Please try again.'),
        }),
      ),
    );
  }

  /**
   * Admin: records a payment for a claimed coupon in the database (Payments table). Only when the
   * server accepts it is the local copy marked Paid, so the carpenter's Total earned page shows it.
   */
  markPaid(code: string, paidType: PaymentType): Observable<MarkPaidResult> {
    return this.http
      .post<{ paidAt: string }>(`${API_URL}/admin/payments/${encodeURIComponent(code)}`, { paidVia: paidType })
      .pipe(
        tap((dto) => {
          this.allClaims.update((list) =>
            list.map((c) =>
              c.code === code ? { ...c, status: 'Paid' as const, paidType, paidAt: dto.paidAt } : c,
            ),
          );
          this.write(CLAIMS_KEY, this.allClaims());
          this.loadAdminCoupons(); // refresh this page and the numbers from the database
        }),
        map((): MarkPaidResult => ({ ok: true })),
        catchError((err: HttpErrorResponse) =>
          of<MarkPaidResult>({ ok: false, reason: this.describe(err, 'Could not save the payment.') }),
        ),
      );
  }

  /** Admin: loads one page of coupons from the database. The tab (status) is applied by the server. */
  loadAdminCoupons(
    page = this.dbPage(),
    pageSize = this.dbPageSize(),
    status = this.dbStatus(),
  ): void {
    this.dbStatus.set(status);
    this.dbLoading.set(true);
    this.dbError.set('');
    this.http
      .get<PagedDto<AdminCouponDto>>(`${API_URL}/admin/coupons`, { params: { page, pageSize, status } })
      .subscribe({
        next: (res) => {
          this.dbCoupons.set(res.items.map((c) => this.toRow(c)));
          this.dbPage.set(res.page);
          this.dbPageSize.set(res.pageSize);
          this.dbTotal.set(res.total);
          this.dbLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.dbError.set(this.describe(err, 'Could not load the coupons.'));
          this.dbLoading.set(false);
        },
      });
    this.loadSummary();
  }

  /** Admin: the totals for the boxes at the top (whole database, not just this page). */
  loadSummary(): void {
    this.http
      .get<{ total: number; unclaimed: number; unpaid: number; paid: number }>(`${API_URL}/admin/coupons/summary`)
      .subscribe({ next: (s) => this.dbSummary.set(s), error: () => undefined });
  }

  /**
   * Admin: saves a new coupon in the database. The server records who created it and when.
   * TODO (API): once the carpenter pages use the API, remove the local copy made below.
   */
  addCoupon(raw: string): Observable<AddCouponResult> {
    const code = raw.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return of<AddCouponResult>({ ok: false, reason: 'Use 4 to 20 letters, numbers or hyphens.' });
    }
    return this.http.post<CouponDto>(`${API_URL}/admin/coupons`, { code }).pipe(
      tap((dto) => {
        const record = this.toRecord(dto);
        const row: CouponRow = {
          ...record,
          status: 'Available',
          claimedByPhone: null,
          claimedByName: null,
          claimedAt: null,
          paidType: null,
          paidAt: null,
          doorPhotoUrl: null,
        };
        this.dbCoupons.update((list) => [row, ...list.filter((c) => c.code !== row.code)]);
        this.dbTotal.update((n) => n + 1);
        // Demo only: the carpenter pages still read localStorage, so keep a copy there.
        if (!this.coupons().some((c) => c.code === record.code)) {
          this.coupons.update((list) => [record, ...list]);
          this.write(COUPONS_KEY, this.coupons());
        }
      }),
      map((dto): AddCouponResult => ({ ok: true, code: dto.code })),
      catchError((err: HttpErrorResponse) =>
        of<AddCouponResult>({ ok: false, reason: this.describe(err, 'Could not add the coupon.') }),
      ),
    );
  }

  private toRow(dto: AdminCouponDto): CouponRow {
    return {
      code: dto.code,
      value: dto.value,
      createdAt: dto.createdAt,
      createdBy: dto.createdBy,
      status: dto.status,
      claimedByPhone: dto.claimedByPhone,
      claimedByName: dto.claimedByName,
      claimedAt: dto.claimedAt,
      paidType: dto.paidVia as PaymentType | null,
      paidAt: dto.paidAt,
      doorPhotoUrl: this.photoUrl(dto.doorPhotoPath),
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

  private toRecord(dto: CouponDto): CouponRecord {
    return { code: dto.code, value: dto.value, createdAt: dto.createdAt, createdBy: dto.createdBy };
  }

  private describe(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 0) {
      return 'Cannot reach the server. Please check that the API is running.';
    }
    if (err.status === 403) {
      return 'You do not have permission to do this.';
    }
    const message = (err.error as { error?: string } | null)?.error;
    return message ?? fallback;
  }

  private loadCoupons(): CouponRecord[] {
    try {
      const raw = localStorage.getItem(COUPONS_KEY);
      if (raw) {
        return JSON.parse(raw) as CouponRecord[];
      }
    } catch {
      return [];
    }
    // First run: start with a few sample coupons so the pages have something to show.
    const now = new Date().toISOString();
    const seed = ['MAKS-1001', 'MAKS-1002', 'MAKS-1003'].map((code) => ({
      code,
      value: CouponService.COUPON_VALUE,
      createdAt: now,
    }));
    this.write(COUPONS_KEY, seed);
    return seed;
  }

  private loadClaims(): ClaimedCoupon[] {
    try {
      const raw = localStorage.getItem(CLAIMS_KEY);
      return raw ? (JSON.parse(raw) as ClaimedCoupon[]) : [];
    } catch {
      return [];
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable: the lists still work for this page load */
    }
  }
}
