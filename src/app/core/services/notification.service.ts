import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}

  showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['snack-success'],
    });
  }

  showError(message: string, action?: string): void {
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
}
