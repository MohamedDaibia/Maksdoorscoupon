import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../api.config';
import { SessionService } from '../session.service';

/** Adds the carpenter's token to calls to /api/carpenter/* and signs out when the server says 401. */
export const carpenterAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${API_URL}/carpenter/`)) {
    return next(req);
  }

  const session = inject(SessionService);
  const router = inject(Router);
  const token = session.token();
  const authorised = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorised).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        session.signOut();
        router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};
