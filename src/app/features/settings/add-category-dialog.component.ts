import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CategoriesService } from '../../core/services/categories.service';

@Component({
  selector: 'app-add-category-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './add-category-dialog.component.html',
  styleUrl: './add-category-dialog.component.scss',
})
export class AddCategoryDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AddCategoryDialogComponent, boolean>);
  private readonly categoriesService = inject(CategoriesService);

  readonly nameInput = signal('');
  readonly inlineError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly touched = signal(false);

  readonly isSaveDisabled = computed(() => {
    return !this.nameInput().trim() || this.saving();
  });

  onNameChange(value: string): void {
    this.nameInput.set(value);
    this.inlineError.set(null);
    this.touched.set(true);
  }

  async onSave(): Promise<void> {
    if (this.saving()) return;
    const name = this.nameInput().trim();
    if (!name) return;
    this.saving.set(true);
    try {
      await this.categoriesService.create({ name });
      this.dialogRef.close(true);
    } catch (err: unknown) {
      this.saving.set(false);
      if (err && typeof err === 'object' && 'type' in err) {
        const appErr = err as { type: string; name?: string };
        if (appErr.type === 'CATEGORY_NAME_DUPLICATE') {
          this.inlineError.set(`A category named '${appErr.name}' already exists`);
          return;
        }
      }
      this.inlineError.set('An error occurred. Please try again.');
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
