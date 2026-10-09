import { PAYMENT_TYPES, PaymentType } from '../../coupon/coupon.service';
import { Component, HostListener, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminCarpentersService, CarpenterPaymentSettings } from '../carpenters/admin-carpenters.service';

/** A slide-in panel on the right: how the carpenter who claimed a coupon wants to be paid. */
@Component({
  selector: 'app-payment-drawer',
  imports: [DatePipe],
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Payment methods">
      <header class="top">
        <div>
          <h2>Payment methods</h2>
          <p class="sub">Coupon <strong class="code">{{ code() }}</strong></p>
        </div>
        <button type="button" class="x" aria-label="Close" (click)="close.emit()">&times;</button>
      </header>

      <div class="body">
        @if (phone() && status() === 'Paid') {
          <p class="paid-note" role="status">
            Paid{{ paidType() ? ' via ' + paidType() : '' }}{{ paidAt() ? ' on ' : '' }}{{ paidAt() | date: 'd MMM y, h:mm a' }}
          </p>
        }

        @if (phone()) {
          <div class="who">
            <strong>{{ name() || 'Carpenter' }}</strong>
            <span class="muted">{{ phone() }}</span>
            <span class="amount">Pay ₹{{ amount() }}</span>
          </div>

          @if (loading()) {
            <p class="muted">Loading payment methods…</p>
          } @else if (error()) {
            <p class="err" role="alert">{{ error() }}</p>
          } @else if (methods().length === 0 && bank().length === 0) {
            <p class="muted">This carpenter has not added any payment methods yet.</p>
          } @else {
            @if (bank().length > 0) {
              <section class="block">
                <h3>Bank account</h3>
                @for (r of bank(); track r.label) {
                  <div class="line">
                    <span class="label">{{ r.label }}</span>
                    <span class="value">{{ r.value }}</span>
                    <button type="button" class="copy" (click)="copy(r.value)">Copy</button>
                  </div>
                }
              </section>
            }
            @for (m of methods(); track m.label) {
              <section class="block">
                <h3>{{ m.label }}</h3>
                <div class="line">
                  <span class="label">{{ m.field }}</span>
                  <span class="value">{{ m.value }}</span>
                  <button type="button" class="copy" (click)="copy(m.value)">Copy</button>
                </div>
              </section>
            }
          }
          @if (status() === 'Pending') {
            <section class="pay">
              <label for="payvia">Payment option</label>
              <select id="payvia" class="select" [value]="option()" (change)="option.set($any($event.target).value)">
                @for (t of paymentTypes; track t) {
                  <option [value]="t" [selected]="t === option()">{{ t }}</option>
                }
              </select>
              @if (payError()) { <p class="err" role="alert">{{ payError() }}</p> }
              <button type="button" class="paid-btn" [disabled]="busy()" (click)="markPaid.emit(option())">
                {{ busy() ? 'Saving…' : 'Paid' }}
              </button>
            </section>
          }

          <figure class="door">
          @if (!doorPhotoUrl()) {
          <p class="muted">No door photo came back from the server. Restart the API so it sends the new photo field.</p>
          } @else if (photoFailed()) {
          <p class="err" role="alert">Could not load the door photo from {{ doorPhotoUrl() }}</p>
          } @else {
          <img [src]="doorPhotoUrl()" alt="Door photo uploaded with this claim" (error)="photoFailed.set(true)" />
          <figcaption>Door photo</figcaption>
          }
          </figure>
        } @else {
          <p class="muted">Nobody has claimed this coupon yet, so there is no one to pay.</p>
        }
      </div>
    </aside>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(40, 24, 10, .4); z-index: 40; animation: fade .2s ease; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 41; width: 380px; max-width: 100%;
      background: #fff; box-shadow: -12px 0 30px rgba(0, 0, 0, .2); display: flex; flex-direction: column;
      animation: slide .25s ease; color: #2a1d12; font-family: inherit;
    }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 18px 20px; background: #f6efe6; border-bottom: 1px solid #eadfce; }
    h2 { margin: 0; font-size: 18px; color: #5a3416; }
    .sub { margin: 4px 0 0; font-size: 13px; color: #7a6a5a; }
    .code { letter-spacing: 1px; white-space: nowrap; }
    .x { border: none; background: none; font-size: 28px; line-height: 1; cursor: pointer; color: #7a6a5a; padding: 0 4px; }
    .body { padding: 18px 20px; overflow-y: auto; flex: 1; }
    .door { margin: 20px 0 0; padding-top: 16px; border-top: 1.5px solid #eadfce; }
    .door img { display: block; width: 100%; max-height: 320px; object-fit: contain; background: #000; border: 2px solid #b9722d; border-radius: 12px; }
    .door figcaption { margin-top: 6px; font-size: 13px; color: #7a6a5a; }
    .who { display: flex; flex-direction: column; gap: 2px; margin-bottom: 18px; padding: 12px 14px; border-radius: 12px; background: #faf7f2; border: 1px solid #eadfce; }
    .amount { margin-top: 6px; font-weight: 700; color: #8a4b14; }
    .block { margin-bottom: 16px; }
    h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .4px; color: #7a6a5a; }
    .line { display: grid; grid-template-columns: 96px 1fr auto; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid #f0e6d8; font-size: 14px; }
    .label { color: #7a6a5a; font-size: 13px; }
    .value { font-weight: 600; word-break: break-all; }
    .copy { padding: 3px 9px; border: 1.5px solid #dccfbf; border-radius: 8px; background: #fff; font-size: 12px; font-weight: 600; cursor: pointer; color: #8a4b14; }
    .copy:hover { background: #f6efe6; }
    .paid-note { margin: 0 0 14px; padding: 10px 14px; border-radius: 10px; background: #e1f4e6; color: #1f6a30; font-weight: 600; font-size: 14px; }
    .pay { margin-top: 20px; padding-top: 16px; border-top: 1.5px solid #eadfce; display: flex; flex-direction: column; gap: 8px; }
    .pay label { font-size: 13px; font-weight: 600; }
    .select { padding: 10px 12px; border: 1.5px solid #dccfbf; border-radius: 10px; background: #fff; color: #2a1d12; font-size: 15px; font-weight: 600; outline: none; }
    .select:focus { border-color: #b9722d; box-shadow: 0 0 0 3px rgba(185, 114, 45, .18); }
    .paid-btn { padding: 12px; border: none; border-radius: 10px; cursor: pointer; background: #2e9d4a; color: #fff; font-size: 16px; font-weight: 700; }
    .paid-btn:hover:not(:disabled) { background: #26833d; }
    .paid-btn:disabled { opacity: .6; cursor: default; }
    .muted { color: #7a6a5a; font-size: 13px; }
    .err { color: #b3261e; font-size: 14px; }
    @keyframes slide { from { transform: translateX(100%); } to { transform: none; } }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .drawer, .backdrop { animation: none; } }
  `,
})
export class PaymentDrawerComponent {
  readonly code = input.required<string>();
  readonly phone = input<string | null>(null);
  readonly name = input('');
  readonly amount = input(0);
  readonly status = input('Available');
  readonly paidType = input<string | null>(null);
  readonly paidAt = input<string | null>(null);
  readonly doorPhotoUrl = input<string | null>(null);
  readonly photoFailed = signal(false);
  readonly payError = input('');
  readonly busy = input(false);
  readonly markPaid = output<PaymentType>();
  readonly close = output<void>();

  readonly paymentTypes = PAYMENT_TYPES;
  /** The payment option picked for this coupon. Defaults to Google Pay. */
  readonly option = signal<PaymentType>('Google Pay');

  private readonly api = inject(AdminCarpentersService);
  readonly settings = signal<CarpenterPaymentSettings | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly bank = computed(() => {
    const s = this.settings();
    if (!s) return [];
    return [
      { label: 'A/c Number', value: s.accountNumber },
      { label: 'Holder name', value: s.accountHolderName },
      { label: 'Branch', value: s.branch },
      { label: 'IFSC code', value: s.ifscCode },
    ].filter((r): r is { label: string; value: string } => !!r.value);
  });

  readonly methods = computed(() => {
    const s = this.settings();
    if (!s) return [];
    return [
      { label: 'UPI', field: 'UPI id', value: s.upiId },
      { label: 'Google Pay', field: 'Number', value: s.googlePayNumber },
      { label: 'PhonePe', field: 'Number', value: s.phonePeNumber },
    ].filter((r): r is { label: string; field: string; value: string } => !!r.value);
  });

  constructor() {
    effect(() => {
      this.doorPhotoUrl();
      this.photoFailed.set(false);
    });
    effect(() => {
      const phone = this.phone();
      this.settings.set(null);
      this.error.set('');
      if (!phone) return;
      this.loading.set(true);
      this.api.paymentSettings(phone).subscribe({
        next: (s) => {
          if (phone !== this.phone()) return;
          this.settings.set(s);
          this.loading.set(false);
        },
        error: () => {
          if (phone !== this.phone()) return;
          this.error.set('Could not load the payment methods.');
          this.loading.set(false);
        },
      });
    });
  }

  copy(value: string): void {
    void navigator.clipboard?.writeText(value).catch(() => undefined);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
