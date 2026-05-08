import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppError } from '../models/error.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}

  showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['snack-success'],
    });
  }

  showError(errorOrMessage: AppError | string, action?: string): void {
    const message =
      typeof errorOrMessage === 'string'
        ? errorOrMessage
        : this.appErrorToMessage(errorOrMessage);
    this.snackBar.open(message, action ?? 'Dismiss', {
      duration: action ? 0 : 5000,
      panelClass: ['snack-error'],
    });
  }

  showInfo(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['snack-info'],
    });
  }

  private appErrorToMessage(error: AppError): string {
    switch (error.type) {
      case 'AUTH_DENIED':
        return 'Sheets access is required to use this app.';
      case 'AUTH_EXPIRED':
        return 'Your session has expired. Please sign in again.';
      case 'AUTH_REVOKED':
        return 'Your session has been revoked. Please sign in again.';
      case 'NETWORK':
        return error.message;
      case 'SHEETS_API':
        return `Sheets API error: ${error.message}`;
      case 'IDB_ERROR':
        return `Storage error: ${error.message}`;
      case 'SYNC_FAILED':
        return `Sync failed: ${error.message}`;
      case 'SCHEMA_VALIDATION':
        return `Data validation error: ${error.message}`;
      case 'SCHEMA_MISMATCH':
        return `Schema mismatch in tab "${error.tabName}"`;
    }
  }
}
