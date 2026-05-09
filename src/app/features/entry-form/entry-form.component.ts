import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EntriesService } from '../../core/services/entries.service';
import { CategoriesService } from '../../core/services/categories.service';
import { NotificationService } from '../../core/services/notification.service';
import { CategoryTileComponent } from '../../shared/components/category-tile/category-tile.component';

@Component({
  selector: 'app-quick-add-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    CategoryTileComponent,
  ],
  templateUrl: './entry-form.component.html',
  styleUrl: './entry-form.component.scss',
})
export class QuickAddSheetComponent implements AfterViewInit {
  private readonly bottomSheetRef = inject(MatBottomSheetRef<QuickAddSheetComponent>);
  private readonly entries = inject(EntriesService);
  private readonly categories = inject(CategoriesService);
  private readonly notification = inject(NotificationService);

  @ViewChild('dateInput', { static: true }) dateInput!: ElementRef<HTMLInputElement>;
  @ViewChild('amountInput', { static: true }) amountInput!: ElementRef<HTMLInputElement>;

  readonly selectedCategoryId = signal<string | null>(null);
  readonly dateValue = signal<string>(this.todayIso());
  readonly amountValue = signal<number | null>(null);
  readonly remarksValue = signal<string>('');
  readonly isSaving = signal(false);

  readonly categoryTiles = this.categories.categoryOrder;
  readonly canSave = computed(() => {
    const amt = this.amountValue();
    return !!this.selectedCategoryId() && amt !== null && amt !== 0;
  });

  ngAfterViewInit(): void {
    queueMicrotask(() => this.dateInput.nativeElement.focus());
  }

  onSelectCategory(id: string): void {
    this.selectedCategoryId.set(id);
    queueMicrotask(() => this.amountInput.nativeElement.focus());
  }

  async onSave(): Promise<void> {
    if (!this.canSave() || this.isSaving()) return;
    this.isSaving.set(true);
    try {
      const categoryId = this.selectedCategoryId()!;
      await this.entries.add({
        date: this.dateValue(),
        category: categoryId,
        amount: this.amountValue()!,
        remarks: this.remarksValue(),
      });
      this.categories.markUsed(categoryId);
      navigator.vibrate?.(10);
      this.bottomSheetRef.dismiss({ saved: true });
    } catch {
      this.notification.showError('Could not save entry — please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.bottomSheetRef.dismiss({ saved: false });
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
