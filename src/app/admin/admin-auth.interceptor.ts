import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../api.config';
import { AdminAuthService } from './admin-auth.service';

/** Adds the admin's token to calls to /api/admin/* and signs out when the server says 401. */
export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const isAdminCall = req.url.startsWith(`${API_URL}/admin/`);
  if (!isAdminCall) {
    return next(req);
  }

  const auth = inject(AdminAuthService);
  const router = inject(Router);
  const isLogin = req.url === `${API_URL}/admin/auth/login`;
  const token = auth.token();

  const authorised = token && !isLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorised).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isLogin) {
        auth.signOut();
        router.navigateByUrl('/admin/login');
      }
      return throwError(() => err);
    }),
  );
};
