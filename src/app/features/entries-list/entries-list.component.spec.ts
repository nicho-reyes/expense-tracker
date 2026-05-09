import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { EntriesListComponent } from './entries-list.component';
import { EntriesService } from '../../core/services/entries.service';
import { CategoriesService } from '../../core/services/categories.service';
import { LocalEntry } from '../../core/models/entry.model';
import { Category } from '../../core/models/category.model';

function makeEntry(overrides: Partial<LocalEntry>): LocalEntry {
  return {
    id: 'uuid-default',
    date: '2026-05-09',
    month: '2026-05',
    year: 2026,
    category: 'food',
    amount: 10.0,
    remarks: '',
    tabName: '2026',
    schemaVersion: '2026',
    sheetRowIndex: null,
    syncStatus: 'synced',
    isReadOnly: false,
    ...overrides,
  };
}

const CAT_FOOD: Category = { id: 'food', name: 'Food', color: '#6366f1', position: 0 };

describe('EntriesListComponent', () => {
  let fixture: ComponentFixture<EntriesListComponent>;
  let entriesSignal: ReturnType<typeof signal<LocalEntry[]>>;
  let categoriesSignal: ReturnType<typeof signal<Category[]>>;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    entriesSignal = signal<LocalEntry[]>([]);
    categoriesSignal = signal<Category[]>([CAT_FOOD]);

    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [EntriesListComponent],
      providers: [
        provideNoopAnimations(),
        { provide: EntriesService, useValue: { entries: entriesSignal } },
        { provide: CategoriesService, useValue: { categories: categoriesSignal } },
        { provide: Router, useValue: routerSpy },
        { provide: MatBottomSheet, useValue: { open: vi.fn(), dismiss: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntriesListComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows EmptyStateComponent when no entries exist (AC8)', () => {
    entriesSignal.set([]);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('app-empty-state'));
    expect(emptyState).not.toBeNull();
  });

  it('hides EmptyStateComponent when entries exist', () => {
    entriesSignal.set([makeEntry({ id: 'a' })]);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('app-empty-state'));
    expect(emptyState).toBeNull();
  });

  it('renders entries in date-desc order (AC1)', () => {
    const older = makeEntry({ id: 'older', date: '2026-05-01', month: '2026-05' });
    const newer = makeEntry({ id: 'newer', date: '2026-05-09', month: '2026-05' });
    const middle = makeEntry({ id: 'middle', date: '2026-05-05', month: '2026-05' });

    entriesSignal.set([older, newer, middle]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('app-entry-row'));
    expect(rows).toHaveLength(3);

    const ids = rows.map(r => r.componentInstance.entry().id);
    expect(ids).toEqual(['newer', 'middle', 'older']);
  });

  it('uses stable id tiebreak for same-date entries (AC1)', () => {
    const e1 = makeEntry({ id: 'aaa', date: '2026-05-09', month: '2026-05' });
    const e2 = makeEntry({ id: 'zzz', date: '2026-05-09', month: '2026-05' });

    entriesSignal.set([e1, e2]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('app-entry-row'));
    const ids = rows.map(r => r.componentInstance.entry().id);
    expect(ids[0]).toBe('zzz');
    expect(ids[1]).toBe('aaa');
  });

  it('groups entries by month with mat-divider between groups (AC1)', () => {
    const may = makeEntry({ id: 'may', date: '2026-05-09', month: '2026-05' });
    const april = makeEntry({ id: 'apr', date: '2026-04-01', month: '2026-04' });

    entriesSignal.set([may, april]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('app-entry-row'));
    expect(rows).toHaveLength(2);

    const dividers = fixture.debugElement.queryAll(By.css('mat-divider'));
    expect(dividers).toHaveLength(1);
  });

  it('scroll container has touch-action: pan-y inline style (AC6)', () => {
    const container = fixture.debugElement.query(By.css('div[style*="touch-action"]'));
    expect(container).not.toBeNull();
    expect(container.nativeElement.style.touchAction).toBe('pan-y');
  });
});
