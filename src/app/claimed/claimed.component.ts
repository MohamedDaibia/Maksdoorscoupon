import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

  /** Which coupon's photo is being uploaded, and the last error (if any). */
  readonly uploading = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);

  onPhotoPicked(code: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow picking the same file again later
    if (!file) {
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.photoError.set('The door photo must be a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError.set('The door photo must be 5 MB or smaller.');
      return;
    }
    this.photoError.set(null);
    this.uploading.set(code);
    this.coupons.changeDoorPhoto(code, file).subscribe((result) => {
      this.uploading.set(null);
      if (!result.ok) {
        this.photoError.set(result.reason);
      }
    });
  }

  readonly totalValue = computed(() => this.pending().reduce((sum, c) => sum + c.reward, 0));
  readonly initial = computed(() => {
    const u = this.user();
    return (u?.name?.trim()[0] ?? u?.phone?.[0] ?? '?').toUpperCase();
  });
}
