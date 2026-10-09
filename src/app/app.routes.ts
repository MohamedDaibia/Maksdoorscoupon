import { Routes } from '@angular/router';
import { AddCouponComponent } from './admin/add-coupon/add-coupon.component';
import { AdminShellComponent } from './admin/admin-shell/admin-shell.component';
import { AdminCarpentersComponent } from './admin/carpenters/admin-carpenters.component';
import { AdminCouponsComponent } from './admin/coupons/admin-coupons.component';
import { AdminLoginComponent } from './admin/admin-login/admin-login.component';
import { adminGuard } from './admin/admin.guard';
import { authGuard } from './auth.guard';
import { ClaimedComponent } from './claimed/claimed.component';
import { CouponComponent } from './coupon/coupon.component';
import { EarnedComponent } from './earned/earned.component';
import { PaymentDetailsComponent } from './payment-details/payment-details.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'coupon', component: CouponComponent, canActivate: [authGuard] },
  { path: 'claimed', component: ClaimedComponent, canActivate: [authGuard] },
  { path: 'payment-details', component: PaymentDetailsComponent, canActivate: [authGuard] },
  { path: 'earned', component: EarnedComponent, canActivate: [authGuard] },

  // Admin. Angular routes are case-sensitive, so /Admin/Login is sent to /admin/login.
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'Admin/Login', redirectTo: 'admin/login', pathMatch: 'full' },
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'carpenters' },
      { path: 'carpenters', component: AdminCarpentersComponent },
      { path: 'coupons', component: AdminCouponsComponent },
      { path: 'coupons/add', component: AddCouponComponent },
    ],
  },
  { path: 'Admin', redirectTo: 'admin', pathMatch: 'full' },

  { path: '**', redirectTo: 'login' },
];
