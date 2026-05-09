import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CategoryManagerComponent } from './category-manager.component';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/category.model';

describe('CategoryManagerComponent', () => {
  const catA: Category = { id: 'a', name: 'Alpha', color: '#111', position: 0 };
  const catB: Category = { id: 'b', name: 'Beta', color: '#222', position: 1 };
  const catC: Category = { id: 'c', name: 'Gamma', color: '#333', position: 2 };

  let categoriesSignal: ReturnType<typeof signal<Category[]>>;
  let categoriesServiceSpy: {
    categories: ReturnType<typeof signal<Category[]>>;
    reorder: ReturnType<typeof vi.fn>;
    refreshFromSheet: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    categoriesSignal = signal<Category[]>([catA, catB, catC]);
    categoriesServiceSpy = {
      categories: categoriesSignal,
      reorder: vi.fn().mockResolvedValue(undefined),
      refreshFromSheet: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    };
    dialogSpy = { open: vi.fn().mockReturnValue({ afterClosed: vi.fn().mockReturnValue({ pipe: vi.fn(), subscribe: vi.fn() }) }) };

    await TestBed.configureTestingModule({
      imports: [CategoryManagerComponent, NoopAnimationsModule],
      providers: [
        { provide: CategoriesService, useValue: categoriesServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(CategoryManagerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders one row per category in position-ascending order (AC1)', () => {
    const fixture = createFixture();
    const rows = fixture.debugElement.queryAll(By.css('.cm-row'));
    expect(rows).toHaveLength(3);
    expect(rows[0].nativeElement.textContent).toContain('Alpha');
    expect(rows[1].nativeElement.textContent).toContain('Beta');
    expect(rows[2].nativeElement.textContent).toContain('Gamma');
  });

  it('shows empty-state CTA when categories() is empty (AC4)', () => {
    categoriesSignal.set([]);
    const fixture = createFixture();
    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState).not.toBeNull();
    const rows = fixture.debugElement.queryAll(By.css('.cm-row'));
    expect(rows).toHaveLength(0);
  });

  it('empty-state CTA click invokes refreshFromSheet (AC4)', async () => {
    categoriesSignal.set([]);
    const fixture = createFixture();
    const btn = fixture.debugElement.query(By.css('.empty-state button'));
    btn.nativeElement.click();
    await fixture.whenStable();
    expect(categoriesServiceSpy.refreshFromSheet).toHaveBeenCalled();
  });

  it('drag handles have aria-label="Reorder category" (AC7)', () => {
    const fixture = createFixture();
    const handles = fixture.debugElement.queryAll(By.css('[cdkDragHandle]'));
    for (const handle of handles) {
      expect(handle.nativeElement.getAttribute('aria-label')).toBe('Reorder category');
    }
  });

  it('onDrop with equal indices does NOT call reorder (AC2)', async () => {
    const fixture = createFixture();
    const comp = fixture.componentInstance;
    const event = { previousIndex: 1, currentIndex: 1 } as CdkDragDrop<Category[]>;
    await comp.onDrop(event);
    expect(categoriesServiceSpy.reorder).not.toHaveBeenCalled();
  });

  it('onDrop with distinct indices calls reorder with post-moveItemInArray id-order (AC2)', async () => {
    const fixture = createFixture();
    const comp = fixture.componentInstance;
    const event = { previousIndex: 2, currentIndex: 0 } as CdkDragDrop<Category[]>;
    await comp.onDrop(event);
    expect(categoriesServiceSpy.reorder).toHaveBeenCalledWith(['c', 'a', 'b']);
  });

  it('onDrop calls navigator.vibrate(10) when available (AC6)', async () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, configurable: true });
    const fixture = createFixture();
    const comp = fixture.componentInstance;
    const event = { previousIndex: 0, currentIndex: 1 } as CdkDragDrop<Category[]>;
    await comp.onDrop(event);
    expect(vibrateMock).toHaveBeenCalledWith(10);
  });

  it('renders a delete button per category row (AC4)', () => {
    const fixture = createFixture();
    const deleteBtns = fixture.debugElement.queryAll(By.css('[aria-label^="Delete "]'));
    expect(deleteBtns).toHaveLength(3);
  });

  it('clicking delete button opens DeleteCategoryDialog (AC4)', async () => {
    const fixture = createFixture();
    const comp = fixture.componentInstance;
    await comp.onDeleteCategory(catA);
    expect(dialogSpy.open).toHaveBeenCalled();
  });

  it('clicking Add category button opens AddCategoryDialog (AC1)', async () => {
    const fixture = createFixture();
    const comp = fixture.componentInstance;
    await comp.onAddCategory();
    expect(dialogSpy.open).toHaveBeenCalled();
  });

  it('renders Add category button (AC1)', () => {
    const fixture = createFixture();
    const addBtn = fixture.debugElement.query(By.css('.cm-header button'));
    expect(addBtn).not.toBeNull();
  });
});
