import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PaymentUnlockService } from './payment-unlock.service';

/**
 * /payment-details opens only right after a correct password (the popup in the header), or during
 * the first-time setup straight after sign-up. Anything else goes back to the coupon page.
 */
export const paymentUnlockGuard: CanActivateFn = (route) => {
  const unlock = inject(PaymentUnlockService);
  if (route.queryParamMap.has('setup') || unlock.consume()) {
    return true;
  }
  return inject(Router).createUrlTree(['/coupon']);
};
