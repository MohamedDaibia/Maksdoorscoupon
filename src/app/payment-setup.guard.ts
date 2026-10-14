import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { API_URL } from './api.config';

/** True when at least one way to be paid is saved: full bank details, a UPI id, a Google Pay or a PhonePe number. */
function hasPaymentMethod(s: Record<string, string | null> | null): boolean {
  const has = (k: string) => !!String(s?.[k] ?? '').trim();
  return (has('accountNumber') && has('accountHolderName') && has('ifscCode')) ||
    has('upiId') || has('googlePayNumber') || has('phonePeNumber');
}

/** Keeps the coupon page closed until the carpenter has filled in payment details. */
export const paymentSetupGuard: CanActivateFn = () => {
  const http = inject(HttpClient);
  const router = inject(Router);
  return http.get<Record<string, string | null>>(`${API_URL}/carpenter/payment-settings`).pipe(
    map((s) => (hasPaymentMethod(s) ? true : router.createUrlTree(['/payment-details'], { queryParams: { setup: 1 } }))),
    catchError(() => of(true)), // if the check itself fails (server down), don't lock the carpenter out
  );
};
