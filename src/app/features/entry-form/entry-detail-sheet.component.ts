import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EntriesService } from '../../core/services/entries.service';
import { CategoriesService } from '../../core/services/categories.service';
import { NotificationService } from '../../core/services/notification.service';
import { CategoryTileComponent } from '../../shared/components/category-tile/category-tile.component';
import {
  DeleteEntryConfirmDialogComponent,
} from './delete-entry-confirm-dialog.component';
import { AppError } from '../../core/models/error.model';

export interface EntryDetailSheetData {
  entryId: string;
  returnFocusTo?: HTMLElement;
}

@Component({
  selector: 'app-entry-detail-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    CategoryTileComponent,
  ],
  templateUrl: './entry-detail-sheet.component.html',
  styleUrl: './entry-detail-sheet.component.scss',
})
export class EntryDetailSheetComponent {
  private readonly sheetData = inject<EntryDetailSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly bottomSheetRef = inject(MatBottomSheetRef<EntryDetailSheetComponent>);
  private readonly entriesService = inject(EntriesService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly notification = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly entry = computed(() => this.entriesService.getById(this.sheetData.entryId));
  readonly isReadOnly = computed(() => this.entry()?.isReadOnly ?? false);

  readonly selectedCategoryId = signal<string | null>(null);
  readonly dateValue = signal<string>('');
  readonly amountValue = signal<number | null>(null);
  readonly remarksValue = signal<string>('');
  readonly isSaving = signal(false);

  readonly categoryTiles = this.categoriesService.categoryOrder;

  readonly canSave = computed(() => {
    const amt = this.amountValue();
    return !!this.selectedCategoryId() && amt !== null && amt !== 0 && !this.isReadOnly();
  });

  constructor() {
    const e = this.entriesService.getById(this.sheetData.entryId);
    if (e) {
      this.dateValue.set(e.date);
      this.selectedCategoryId.set(e.category);
      this.amountValue.set(e.amount);
      this.remarksValue.set(e.remarks);
    }
  }

  onSelectCategory(id: string): void {
    if (!this.isReadOnly()) {
      this.selectedCategoryId.set(id);
    }
  }

  async onSave(): Promise<void> {
    if (!this.canSave() || this.isSaving()) return;
    this.isSaving.set(true);
    try {
      await this.entriesService.update(this.sheetData.entryId, {
        date: this.dateValue(),
        category: this.selectedCategoryId()!,
        amount: this.amountValue()!,
        remarks: this.remarksValue(),
      });
      this.bottomSheetRef.dismiss();
    } catch {
      // error already shown by EntriesService
    } finally {
      this.isSaving.set(false);
    }
  }

  onDelete(): void {
    const entry = this.entry();
    if (!entry || this.isReadOnly()) return;

    const dialogRef = this.dialog.open(DeleteEntryConfirmDialogComponent, {
      data: { entry },
    });

    dialogRef.afterClosed().subscribe(async (confirmed: boolean) => {
      if (!confirmed) return;
      try {
        const snapshot = await this.entriesService.delete(entry.id);
        this.bottomSheetRef.dismiss();
        if (snapshot) {
          const snackRef = this.notification.showUndoableDelete(snapshot);
          let undoTaken = false;
          snackRef.onAction().subscribe(() => { undoTaken = true; });
          snackRef.afterDismissed().subscribe(() => {
            if (undoTaken) {
              this.entriesService.restore(snapshot).catch(err =>
                this.notification.showError(err as AppError),
              );
            } else {
              this.entriesService.finalizeDelete(snapshot).catch(err =>
                this.notification.showError(err as AppError),
              );
            }
          });
        }
      } catch {
        // error already shown by EntriesService
      }
    });
  }

  onCancel(): void {
    this.bottomSheetRef.dismiss();
  }
}
