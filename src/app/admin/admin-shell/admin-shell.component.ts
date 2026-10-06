import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthService } from '../admin-auth.service';

/** Layout for every admin page: logo, nav (Carpenters, Coupons) and the Add Coupon button. */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.css',
})
export class AdminShellComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly admin = this.auth.admin;

  signOut(): void {
    this.auth.signOut();
    this.router.navigateByUrl('/admin/login');
  }
}
