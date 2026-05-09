import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDividerModule } from '@angular/material/divider';
import { EntriesService } from '../../core/services/entries.service';
import { CategoriesService } from '../../core/services/categories.service';
import { EntryRowComponent } from '../../shared/components/entry-row/entry-row.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LocalEntry } from '../../core/models/entry.model';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-entries-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDividerModule, EntryRowComponent, EmptyStateComponent],
  templateUrl: './entries-list.component.html',
  styleUrl: './entries-list.component.scss',
})
export class EntriesListComponent {
  private readonly entriesSvc = inject(EntriesService);
  private readonly categoriesSvc = inject(CategoriesService);
  private readonly router = inject(Router);
  private readonly bottomSheet = inject(MatBottomSheet);

  readonly entries = computed<LocalEntry[]>(() =>
    [...this.entriesSvc.entries()].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.id.localeCompare(a.id);
    }),
  );

  readonly groupedEntries = computed<Array<{ month: string; entries: LocalEntry[] }>>(() => {
    const groups = new Map<string, LocalEntry[]>();
    for (const e of this.entries()) {
      if (!groups.has(e.month)) groups.set(e.month, []);
      groups.get(e.month)!.push(e);
    }
    return Array.from(groups.entries()).map(([month, entries]) => ({ month, entries }));
  });

  readonly categoryById = computed<Map<string, Category>>(() => {
    const map = new Map<string, Category>();
    for (const c of this.categoriesSvc.categories()) map.set(c.id, c);
    return map;
  });

  onEntryTap(entry: LocalEntry): void {
    // Story 2.4 will open the edit sheet here. For now, no-op.
  }

  onAddCta(): void {
    this.router.navigate(['/']);
  }
}
