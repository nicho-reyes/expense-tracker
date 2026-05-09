import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('https://sheets.googleapis.com')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  const clonedReq = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        return auth.handleUnauthorized().pipe(
          switchMap((newToken) =>
            next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${newToken}`) }))
          ),
        );
      }
      return throwError(() => error);
    }),
  );
};
