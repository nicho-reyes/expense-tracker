import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { LocalEntry } from '../../core/models/entry.model';

export interface DeleteEntryConfirmDialogData {
  entry: LocalEntry;
}

const CHF_FORMATTER = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

@Component({
  selector: 'app-delete-entry-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './delete-entry-confirm-dialog.component.html',
  styleUrl: './delete-entry-confirm-dialog.component.scss',
})
export class DeleteEntryConfirmDialogComponent {
  readonly data = inject<DeleteEntryConfirmDialogData>(MAT_DIALOG_DATA);

  get summary(): string {
    const e = this.data.entry;
    return `${e.date} · ${e.category} · CHF ${CHF_FORMATTER.format(e.amount)}`;
  }
}
