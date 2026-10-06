import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CouponService,
  CouponState,
  PAYMENT_TYPES,
  PaymentType,
} from '../../coupon/coupon.service';
import { SessionService } from '../../session.service';

type Filter = 'all' | 'claimed' | 'unclaimed' | 'unpaid' | 'paid';

@Component({
  selector: 'app-admin-coupons',
  imports: [DatePipe, RouterLink],
  styleUrl: '../admin-pages.css',
  template: `
    <div class="head">
      <h1>Coupons</h1>
    </div>

    <div class="stats">
      <div class="stat"><span class="stat-label">Total</span><span class="stat-value">{{ rows().length }}</span></div>
      <div class="stat"><span class="stat-label">Unclaimed</span><span class="stat-value">{{ count('Available') }}</span></div>
      <div class="stat"><span class="stat-label">Unpaid</span><span class="stat-value">{{ count('Pending') }}</span></div>
      <div class="stat"><span class="stat-label">Paid</span><span class="stat-value">{{ count('Paid') }}</span></div>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter coupons">
      @for (t of tabs; track t.key) {
        <button type="button" role="tab" class="tab" [class.active]="filter() === t.key"
                [attr.aria-selected]="filter() === t.key" (click)="filter.set(t.key)">
          {{ t.label }} <span class="tab-count">{{ tabCount(t.key) }}</span>
        </button>
      }
    </div>

    @if (rows().length === 0) {
      <div class="empty">
        <p>No coupons yet.</p>
        <a class="cta" routerLink="/admin/coupons/add">+ Add Coupon</a>
      </div>
    } @else if (shown().length === 0) {
      <div class="empty">
        <p>{{ emptyMessage() }}</p>
      </div>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Coupon number</th>
              <th scope="col">Value</th>
              <th scope="col">Added</th>
              <th scope="col">Claimed by</th>
              <th scope="col">Paid type</th>
              <th scope="col">Payment status</th>
            </tr>
          </thead>
          <tbody>
            @for (c of shown(); track c.code) {
              <tr>
                <td data-label="Coupon number" class="code">{{ c.code }}</td>
                <td data-label="Value">₹{{ c.value }}</td>
                <td data-label="Added" class="muted">{{ c.createdAt | date: 'd MMM y, h:mm a' }}</td>

                <td data-label="Claimed by">
                  @if (c.claimedByPhone) {
                    <div class="stack">
                      <strong>{{ c.claimedByPhone }}</strong>
                      @if (c.claimedByLabel) { <span class="muted">{{ c.claimedByLabel }}</span> }
                    </div>
                  } @else {
                    <span class="muted">-</span>
                  }
                </td>

                <td data-label="Paid type">
                  @if (c.status === 'Pending') {
                    <select class="select" [attr.aria-label]="'Paid type for ' + c.code"
                            (change)="setType(c.code, $any($event.target).value)">
                      @for (t of paymentTypes; track t) {
                        <option [value]="t" [selected]="t === typeFor(c.code)">{{ t }}</option>
                      }
                    </select>
                  } @else if (c.status === 'Paid') {
                    {{ c.paidType ?? '-' }}
                  } @else {
                    <span class="muted">-</span>
                  }
                </td>

                <td data-label="Payment status">
                  <div class="stack">
                    <span class="badge" [class]="'badge status-' + c.status.toLowerCase()">{{ label(c.status) }}</span>
                    @if (c.status === 'Pending') {
                      <button type="button" class="pay-btn" (click)="markPaid(c.code)">Mark as paid</button>
                    } @else if (c.status === 'Paid' && c.paidAt) {
                      <span class="muted">{{ c.paidAt | date: 'd MMM y' }}</span>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminCouponsComponent {
  private readonly coupons = inject(CouponService);
  private readonly carpenters = inject(SessionService).carpenters;

  readonly paymentTypes = PAYMENT_TYPES;
  /** Paid type picked per coupon before marking it paid. Defaults to Google Pay. */
  private readonly chosenType = signal<Record<string, PaymentType>>({});

  readonly rows = computed(() => {
    const people = new Map(this.carpenters().map((c) => [c.phone, c]));
    return this.coupons.adminCoupons().map((c) => {
      const person = c.claimedByPhone ? people.get(c.claimedByPhone) : undefined;
      return {
        ...c,
        // "Name (District)" under the phone number
        claimedByLabel: person ? `${person.name} (${person.district})` : '',
      };
    });
  });

  readonly filter = signal<Filter>('all');
  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'unclaimed', label: 'Unclaimed' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'paid', label: 'Paid' },
  ];

  /** The rows that match the selected tab. */
  readonly shown = computed(() => this.rowsFor(this.filter()));

  count(status: CouponState): number {
    return this.rows().filter((c) => c.status === status).length;
  }

  tabCount(key: Filter): number {
    return this.rowsFor(key).length;
  }

  /** Unpaid means claimed by a carpenter but not paid yet. */
  label(status: CouponState): string {
    if (status === 'Pending') {
      return 'Unpaid';
    }
    return status === 'Available' ? 'Unclaimed' : status;
  }

  typeFor(code: string): PaymentType {
    return this.chosenType()[code] ?? 'Google Pay';
  }

  setType(code: string, value: string): void {
    if ((PAYMENT_TYPES as string[]).includes(value)) {
      this.chosenType.update((m) => ({ ...m, [code]: value as PaymentType }));
    }
  }

  markPaid(code: string): void {
    const type = this.typeFor(code);
    if (confirm(`Mark ${code} as paid by ${type}?`)) {
      this.coupons.markPaid(code, type);
    }
  }

  emptyMessage(): string {
    switch (this.filter()) {
      case 'claimed':
        return 'No claimed coupons yet.';
      case 'unclaimed':
        return 'No unclaimed coupons.';
      case 'paid':
        return 'No paid coupons yet.';
      default:
        return 'No unpaid coupons.';
    }
  }

  private rowsFor(key: Filter) {
    const all = this.rows();
    if (key === 'claimed') {
      // Claimed by a carpenter, whether or not it has been paid yet.
      return all.filter((c) => c.status !== 'Available');
    }
    if (key === 'unclaimed') {
      return all.filter((c) => c.status === 'Available');
    }
    if (key === 'unpaid') {
      return all.filter((c) => c.status === 'Pending');
    }
    if (key === 'paid') {
      return all.filter((c) => c.status === 'Paid');
    }
    return all;
  }
}
