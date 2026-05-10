import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { SheetsService } from '../../core/services/sheets.service';
import { HydrationService } from '../../core/services/hydration.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppError } from '../../core/models/error.model';
import { SheetsSheetMeta, TabSchemaResult } from '../../core/models/sheets.model';

type SetupStep = 'input' | 'validating' | 'confirm';

@Component({
  selector: 'app-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private readonly sheets = inject(SheetsService);
  private readonly hydration = inject(HydrationService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  readonly step = signal<SetupStep>('input');
  readonly inputValue = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly warnMessage = signal<string | null>(null);
  readonly spreadsheetTitle = signal<string | null>(null);

  private pendingSpreadsheetId: string | null = null;
  private pendingTabs: SheetsSheetMeta[] = [];
  private pendingResults: TabSchemaResult[] | null = null;

  async onValidate(): Promise<void> {
    const spreadsheetId = this.sheets.extractSpreadsheetId(this.inputValue());
    if (!spreadsheetId) {
      this.errorMessage.set('Enter a valid Google Sheets URL or spreadsheet ID.');
      return;
    }
    this.warnMessage.set(null);
    this.pendingResults = null;
    this.step.set('validating');
    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      const meta = await firstValueFrom(this.sheets.fetchSpreadsheetMeta(spreadsheetId));
      this.spreadsheetTitle.set(meta.properties.title);
      this.pendingSpreadsheetId = spreadsheetId;
      this.pendingTabs = meta.sheets;
      this.step.set('confirm');
    } catch (err) {
      this.errorMessage.set(this.mapError(err as AppError));
      this.step.set('input');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onConnect(): Promise<void> {
    if (!this.pendingSpreadsheetId) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      if (!this.pendingTabs.length) {
        this.errorMessage.set('No sheet tabs were found in this spreadsheet.');
        return;
      }

      const results =
        this.pendingResults ??
        (await this.sheets.validateAllTabs(this.pendingSpreadsheetId, this.pendingTabs));

      const mismatches = results.filter((r) => r.type === 'mismatch');
      if (mismatches.length > 0) {
        const tabNames = mismatches.map((r) => r.tabName).join(', ');
        this.errorMessage.set(
          `Tab "${tabNames}" is missing column F (UUID). Add a "UUID" header to column F and try again.`,
        );
        return;
      }

      const invalids = results.filter((r) => r.type === 'invalid');
      if (invalids.length > 0 && !this.warnMessage()) {
        const tabLabel = invalids.length === 1 ? 'Tab' : 'Tabs';
        const names = invalids.map((r) => `"${r.tabName}"`).join(', ');
        this.warnMessage.set(
          `${tabLabel} ${names} ${invalids.length === 1 ? 'has' : 'have'} unrecognized columns and will be skipped. Click "Confirm & Connect" to proceed.`,
        );
        for (const inv of invalids) {
          this.notification.showError(`Tab "${inv.tabName}" has unrecognized columns and will be skipped.`);
        }
        this.pendingResults = results;
        return;
      }

      const errors = results.filter((r) => r.type === 'error');
      for (const err of errors) {
        this.notification.showError(`Could not read tab "${err.tabName}" — it will be skipped.`);
      }

      const schemaCache: Record<string, '2026' | '2025' | 'natural'> = {};
      for (const r of results) {
        if (r.type === '2026' || r.type === '2025' || r.type === 'natural') {
          schemaCache[r.tabName] = r.type;
        }
      }

      await this.sheets.connectSheet(this.pendingSpreadsheetId, schemaCache);
      await this.hydration.hydrate({ force: false });
      await this.router.navigate(['/']);
    } catch (err) {
      this.errorMessage.set(this.mapError(err as AppError));
    } finally {
      this.isLoading.set(false);
    }
  }

  onBack(): void {
    this.step.set('input');
    this.errorMessage.set(null);
    this.warnMessage.set(null);
    this.pendingSpreadsheetId = null;
    this.pendingTabs = [];
    this.pendingResults = null;
  }

  private mapError(err: AppError): string {
    switch (err.type) {
      case 'SHEETS_API':
        return err.message;
      case 'SCHEMA_MISMATCH':
        return `Tab "${err.tabName}" is missing column F (UUID). Add a "UUID" header and retry.`;
      case 'SCHEMA_VALIDATION':
        return `Data validation error: ${err.message}`;
      case 'NETWORK':
        return `Connection failed — check your internet and try again.`;
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}
