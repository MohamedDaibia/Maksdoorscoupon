import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { SessionService } from '../session.service';

export type CouponResult =
  | { valid: true; reward: number }
  | { valid: false; reason: string };

/** How a carpenter was paid. */
export type PaymentType = 'Google Pay' | 'PhonePe' | 'Cash';
export const PAYMENT_TYPES: PaymentType[] = ['Google Pay', 'PhonePe', 'Cash'];

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
}

/** A coupon as the admin sees it: Available until someone claims it. */
export type CouponState = 'Available' | ClaimStatus;

export interface CouponRow extends CouponRecord {
  status: CouponState;
  claimedByPhone: string | null;
  claimedAt: string | null;
  paidType: PaymentType | null;
  paidAt: string | null;
}

export type AddCouponResult = { ok: true; code: string } | { ok: false; reason: string };

const COUPONS_KEY = 'maks.coupons';
const CLAIMS_KEY = 'maks.claims';
const CODE_PATTERN = /^[A-Z0-9-]{4,20}$/;

/**
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

  /** Admin view: every coupon with its current state and who claimed it. */
  readonly adminCoupons = computed<CouponRow[]>(() => {
    const claims = this.allClaims();
    return this.coupons().map((c) => {
      const claim = claims.find((x) => x.code === c.code);
      return {
        ...c,
        status: claim ? claim.status : 'Available',
        claimedByPhone: claim?.phone ?? null,
        claimedAt: claim?.claimedAt ?? null,
        paidType: claim?.paidType ?? null,
        paidAt: claim?.paidAt ?? null,
      };
    });
  });

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

  check(code: string): Observable<CouponResult> {
    return of(this.evaluate(code)).pipe(delay(600));
  }

  /**
   * TODO (API): send the coupon number and the door photo together, for example as
   * FormData with a "code" field and a "doorPhoto" file, and store the photo with the claim.
   */
  claim(code: string, doorPhoto: File | null): Observable<CouponResult> {
    if (!doorPhoto) {
      return of<CouponResult>({
        valid: false,
        reason: 'Please add a photo of the door to claim this coupon.',
      }).pipe(delay(300));
    }
    const result = this.evaluate(code);
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
    return of(result).pipe(delay(700));
  }

  /**
   * Admin: records that a claimed coupon has been paid, and how. It then shows under
   * "Paid" on the carpenter's Total earned page.
   * TODO (API): do this on the server, only for admins, and record who marked it paid.
   */
  markPaid(code: string, paidType: PaymentType): boolean {
    const claim = this.allClaims().find((c) => c.code === code);
    if (!claim || claim.status === 'Paid') {
      return false;
    }
    this.allClaims.update((list) =>
      list.map((c) =>
        c.code === code
          ? { ...c, status: 'Paid' as const, paidType, paidAt: new Date().toISOString() }
          : c,
      ),
    );
    this.write(CLAIMS_KEY, this.allClaims());
    return true;
  }

  /** Admin: creates a new coupon worth COUPON_VALUE. */
  addCoupon(raw: string): AddCouponResult {
    const code = raw.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return { ok: false, reason: 'Use 4 to 20 letters, numbers or hyphens.' };
    }
    if (this.coupons().some((c) => c.code === code)) {
      return { ok: false, reason: 'That coupon number already exists.' };
    }
    const record: CouponRecord = {
      code,
      value: CouponService.COUPON_VALUE,
      createdAt: new Date().toISOString(),
    };
    this.coupons.update((list) => [record, ...list]);
    this.write(COUPONS_KEY, this.coupons());
    return { ok: true, code };
  }

  private evaluate(code: string): CouponResult {
    if (!CODE_PATTERN.test(code)) {
      return { valid: false, reason: 'Coupon numbers use only letters, numbers and hyphens.' };
    }
    const record = this.coupons().find((c) => c.code === code);
    if (!record) {
      return { valid: false, reason: 'This coupon number is not correct. Please check and try again.' };
    }
    // A coupon can be claimed once, by anyone.
    if (this.allClaims().some((c) => c.code === code)) {
      return { valid: false, reason: 'This coupon has already been claimed.' };
    }
    return { valid: true, reward: record.value };
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
