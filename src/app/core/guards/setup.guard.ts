import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SheetsService } from '../services/sheets.service';

export const setupGuard: CanActivateFn = async () => {
  const sheets = inject(SheetsService);
  const router = inject(Router);
  await sheets.ensureLoaded();
  if (!sheets.isSheetConnected()) {
    return router.createUrlTree(['/setup']);
  }
  return true;
};
