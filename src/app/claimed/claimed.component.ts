import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CouponService } from '../coupon/coupon.service';
import { HeaderComponent } from '../shared/header.component';
import { SessionService } from '../session.service';

@Component({
  selector: 'app-claimed',
  imports: [DatePipe, RouterLink, HeaderComponent],
  templateUrl: './claimed.component.html',
  styleUrl: './claimed.component.css',
})
export class ClaimedComponent implements OnInit {
  private readonly coupons = inject(CouponService);

  readonly user = inject(SessionService).user;

  ngOnInit(): void {
    this.coupons.loadMyClaims();
  }

  /** Only coupons still waiting to be paid. */
  readonly pending = this.coupons.myPendingCoupons;
  readonly totalEarned = this.coupons.totalEarned;

  readonly totalValue = computed(() => this.pending().reduce((sum, c) => sum + c.reward, 0));
  readonly initial = computed(() => {
    const u = this.user();
    return (u?.name?.trim()[0] ?? u?.phone?.[0] ?? '?').toUpperCase();
  });
}
