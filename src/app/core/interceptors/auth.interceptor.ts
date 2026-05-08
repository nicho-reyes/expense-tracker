import { HttpInterceptorFn } from '@angular/common/http';

// Token injection implemented in Story 1.2
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
