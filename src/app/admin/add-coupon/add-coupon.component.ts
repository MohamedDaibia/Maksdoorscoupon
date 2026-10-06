import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CouponService } from '../../coupon/coupon.service';

@Component({
  selector: 'app-add-coupon',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: '../admin-pages.css',
  template: `
    <div class="head">
      <h1>Add Coupon</h1>
      <p class="total-line">Total coupon generated: <strong>{{ total() }}</strong></p>
    </div>

    <form class="panel" (ngSubmit)="onSubmit()" novalidate>
      <p class="subtitle" style="margin-top: 0">Create a coupon number that carpenters can redeem.</p>

      @if (addedCode()) {
        <div class="success" role="status">
          Coupon {{ addedCode() }} added. <a routerLink="/admin/coupons">View all coupons</a>
        </div>
      }

      <div class="field">
        <label for="code">Coupon number</label>
        <div class="input-row">
          <input id="code" class="text" type="text" [formControl]="code" placeholder="e.g. MAKS-1004"
                 autocomplete="off" autocapitalize="characters" spellcheck="false" />
          <button type="button" class="ghost" (click)="generate()">Generate</button>
        </div>
        @if (error()) {
          <span class="error" role="alert">{{ error() }}</span>
        } @else if (code.invalid && code.touched) {
          <span class="error">Use 4 to 20 letters, numbers or hyphens.</span>
        }
      </div>

      <div class="field">
        <label>Value</label>
        <div class="readonly">₹{{ value }}</div>
      </div>

      <div class="form-actions">
        <button type="submit" class="cta">Add coupon</button>
        <a class="cancel" routerLink="/admin/coupons">Cancel</a>
      </div>
    </form>
  `,
})
export class AddCouponComponent {
  private readonly coupons = inject(CouponService);

  readonly value = CouponService.COUPON_VALUE;
  /** How many coupons exist so far. Updates as soon as one is added. */
  readonly total = computed(() => this.coupons.coupons().length);
  readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{4,20}$/)],
  });
  readonly error = signal('');
  readonly addedCode = signal('');

  constructor() {
    this.code.valueChanges.subscribe(() => {
      this.error.set('');
      this.addedCode.set('');
    });
  }

  /** Makes a random number like MAKS-7H2K9Q (no look-alike letters or digits). */
  generate(): void {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    this.code.setValue(`MAKS-${suffix}`);
  }

  onSubmit(): void {
    if (this.code.invalid) {
      this.code.markAsTouched();
      return;
    }
    const result = this.coupons.addCoupon(this.code.value);
    if (result.ok) {
      this.code.reset('', { emitEvent: false });
      this.code.markAsUntouched();
      this.error.set('');
      this.addedCode.set(result.code);
    } else {
      this.error.set(result.reason);
    }
  }
}
