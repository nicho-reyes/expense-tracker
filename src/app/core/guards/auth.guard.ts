import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  // Active logic implemented in Story 1.2
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth']);
  }
  return true;
};
