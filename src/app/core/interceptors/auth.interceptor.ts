import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('https://sheets.googleapis.com')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getAccessToken();
  const authedReq = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(authedReq).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return authService.handleUnauthorized().pipe(
          switchMap((newToken) =>
            next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${newToken}`) })),
          ),
        );
      }
      return throwError(() => error);
    }),
  );
};
