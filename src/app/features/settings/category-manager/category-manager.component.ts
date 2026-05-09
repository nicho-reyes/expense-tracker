import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/category.model';

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
  readonly categories = this.categoriesService.categories;

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

  async onSyncCta(): Promise<void> {
    await this.categoriesService.refreshFromSheet();
  }
}
