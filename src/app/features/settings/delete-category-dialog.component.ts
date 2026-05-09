import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Category } from '../../core/models/category.model';
import { CategoriesService } from '../../core/services/categories.service';
import { AppError } from '../../core/models/error.model';

export type DeleteCategoryDialogData = Category;

type DialogState = 'confirm' | 'in-use';

@Component({
  selector: 'app-delete-category-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './delete-category-dialog.component.html',
})
export class DeleteCategoryDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeleteCategoryDialogComponent, boolean>);
  readonly category = inject<DeleteCategoryDialogData>(MAT_DIALOG_DATA);
  private readonly categoriesService = inject(CategoriesService);

  readonly state = signal<DialogState>('confirm');
  readonly entryCount = signal<number>(0);
  readonly deleting = signal(false);

  async onDelete(): Promise<void> {
    this.deleting.set(true);
    try {
      await this.categoriesService.delete(this.category.id);
      this.dialogRef.close(true);
    } catch (err: unknown) {
      this.deleting.set(false);
      const appErr = err as AppError;
      if (appErr?.type === 'CATEGORY_IN_USE') {
        this.entryCount.set(appErr.entryCount);
        this.state.set('in-use');
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onDismiss(): void {
    this.dialogRef.close(false);
  }
}
