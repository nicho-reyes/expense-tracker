import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/category.model';
import { ColorPickerDialog, ColorPickerData } from '../color-picker.dialog';
import { AddCategoryDialogComponent } from '../add-category-dialog.component';
import { DeleteCategoryDialogComponent, DeleteCategoryDialogData } from '../delete-category-dialog.component';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DragDropModule, MatButtonModule, MatIconModule],
  templateUrl: './category-manager.component.html',
  styleUrl: './category-manager.component.scss',
})
export class CategoryManagerComponent {
  private readonly categoriesService = inject(CategoriesService);
  private readonly dialog = inject(MatDialog);
  readonly categories = this.categoriesService.categories;
  private colorDialogOpen = false;

  async onDrop(event: CdkDragDrop<Category[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const current = [...this.categories()];
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    const reorderedIds = current.map(c => c.id);
    navigator.vibrate?.(10);
    try {
      await this.categoriesService.reorder(reorderedIds);
    } catch {
      // CategoriesService already surfaced the error and rolled back the signal.
    }
  }

  async onColorTap(category: Category): Promise<void> {
    if (this.colorDialogOpen) return;
    this.colorDialogOpen = true;
    const ref = this.dialog.open<ColorPickerDialog, ColorPickerData, string | null>(
      ColorPickerDialog,
      { data: { categoryId: category.id, currentColor: category.color } },
    );
    const result = await firstValueFrom(ref.afterClosed(), { defaultValue: null });
    this.colorDialogOpen = false;
    if (result != null) {
      await this.categoriesService.update({ ...category, color: result });
    }
  }

  async onSyncCta(): Promise<void> {
    await this.categoriesService.refreshFromSheet();
  }

  onAddCategory(): void {
    this.dialog.open<AddCategoryDialogComponent, void, boolean>(AddCategoryDialogComponent);
  }

  onDeleteCategory(category: Category): void {
    this.dialog.open<DeleteCategoryDialogComponent, DeleteCategoryDialogData, boolean>(
      DeleteCategoryDialogComponent,
      { data: category },
    );
  }
}
