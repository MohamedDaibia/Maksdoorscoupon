import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CouponService } from '../coupon/coupon.service';
import { HeaderComponent } from '../shared/header.component';
import { SessionService } from '../session.service';

@Component({
  selector: 'app-earned',
  imports: [DatePipe, RouterLink, HeaderComponent],
  templateUrl: './earned.component.html',
  styleUrl: './earned.component.css',
})
export class EarnedComponent {
  private readonly coupons = inject(CouponService);

  readonly user = inject(SessionService).user;

  /** Coupons that have already been paid. */
  readonly paid = this.coupons.myPaidCoupons;
  readonly totalEarned = this.coupons.totalEarned;
}
