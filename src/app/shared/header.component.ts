import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PaymentUnlockService } from '../payment-unlock.service';
import { SessionService } from '../session.service';
import { ContactBadgeComponent } from './contact-badge.component';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, FormsModule, ContactBadgeComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly user = this.session.user;
  readonly initial = computed(() => {
    const u = this.user();
    return (u?.name?.trim()[0] ?? u?.phone?.[0] ?? '?').toUpperCase();
  });
  readonly menuOpen = signal(false);

  private readonly unlock = inject(PaymentUnlockService);
  readonly pwOpen = signal(false);
  readonly pwBusy = signal(false);
  readonly pwError = signal('');
  readonly showPw = signal(false);
  pwValue = '';

  onCouponPage(): boolean {
    return this.router.url.startsWith('/coupon');
  }

  onPaymentPage(): boolean {
    return this.router.url.startsWith('/payment-details');
  }

  openPasswordPrompt(): void {
    this.pwValue = '';
    this.pwError.set('');
    this.showPw.set(false);
    this.pwOpen.set(true);
  }

  closePasswordPrompt(): void {
    this.pwOpen.set(false);
    this.pwValue = '';
  }

  submitPassword(): void {
    if (!this.pwValue || this.pwBusy()) {
      this.pwError.set(this.pwValue ? '' : 'Please enter your password.');
      return;
    }
    this.pwBusy.set(true);
    this.pwError.set('');
    this.unlock.verify(this.pwValue).subscribe((result) => {
      this.pwBusy.set(false);
      if (result.ok) {
        this.closePasswordPrompt();
        this.router.navigateByUrl('/payment-details');
      } else {
        this.pwError.set(result.reason);
      }
    });
  }

  signOut(): void {
    this.menuOpen.set(false);
    this.session.signOut();
    this.router.navigateByUrl('/login');
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    const profile = this.host.nativeElement.querySelector('.profile');
    if (this.menuOpen() && profile && !profile.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }
}
