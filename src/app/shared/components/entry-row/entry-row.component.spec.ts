import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { EntryRowComponent } from './entry-row.component';
import { LocalEntry } from '../../../core/models/entry.model';
import { Category } from '../../../core/models/category.model';

const BASE_ENTRY: LocalEntry = {
  id: 'uuid-1',
  date: '2026-05-09',
  month: '2026-05',
  year: 2026,
  category: 'food',
  amount: 25.0,
  remarks: '',
  tabName: '2026',
  schemaVersion: '2026',
  sheetRowIndex: null,
  syncStatus: 'synced',
  isReadOnly: false,
};

const CAT: Category = { id: 'food', name: 'Food', color: '#6366f1', position: 0 };

describe('EntryRowComponent', () => {
  let fixture: ComponentFixture<EntryRowComponent>;
  let component: EntryRowComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntryRowComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryRowComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setEntry(overrides: Partial<LocalEntry> = {}) {
    fixture.componentRef.setInput('entry', { ...BASE_ENTRY, ...overrides });
    fixture.componentRef.setInput('category', CAT);
    fixture.detectChanges();
  }

  it('renders positive amount without + prefix using default color class', () => {
    setEntry({ amount: 120.0 });

    const amountEl = fixture.nativeElement.querySelector('[class*="text-zinc-900"]') as HTMLElement;
    expect(amountEl).not.toBeNull();
    expect(amountEl.textContent?.trim()).toBe('120.00');
  });

  it('renders negative amount with + prefix and green color class (AC3)', () => {
    setEntry({ amount: -12.5 });

    const amountEl = fixture.nativeElement.querySelector('[class*="text-green-600"]') as HTMLElement;
    expect(amountEl).not.toBeNull();
    expect(amountEl.textContent?.trim()).toBe('+12.50');
  });

  it('color dot has aria-hidden="true" (AC2)', () => {
    setEntry();

    const dot = fixture.nativeElement.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dot).not.toBeNull();
  });

  it('PENDING entry: color dot has opacity-50 class (AC4)', () => {
    setEntry({ syncStatus: 'pending' });

    const dot = fixture.debugElement.query(By.css('[aria-hidden="true"]'));
    expect(dot.nativeElement.classList.contains('opacity-50')).toBe(true);
  });

  it('SYNCED entry: color dot does NOT have opacity-50', () => {
    setEntry({ syncStatus: 'synced' });

    const dot = fixture.debugElement.query(By.css('[aria-hidden="true"]'));
    expect(dot.nativeElement.classList.contains('opacity-50')).toBe(false);
  });

  it('SYNC_ERROR entry: amber icon with aria-label="Sync error" is shown (AC5)', () => {
    setEntry({ syncStatus: 'error' });

    const icon = fixture.nativeElement.querySelector('mat-icon[aria-label="Sync error"]') as HTMLElement;
    expect(icon).not.toBeNull();
  });

  it('no sync error icon when syncStatus is synced', () => {
    setEntry({ syncStatus: 'synced' });

    const icon = fixture.nativeElement.querySelector('mat-icon[aria-label="Sync error"]');
    expect(icon).toBeNull();
  });

  it('clicking the row emits tap with the entry (AC6)', () => {
    const entry: LocalEntry = { ...BASE_ENTRY };
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('category', CAT);
    fixture.detectChanges();

    const emitted: LocalEntry[] = [];
    component.tap.subscribe(e => emitted.push(e));

    const btn = fixture.debugElement.query(By.css('button'));
    btn.nativeElement.click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].id).toBe(entry.id);
  });

  it('row button has touch-action: manipulation (AC6)', () => {
    setEntry();

    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn.nativeElement.style.touchAction).toBe('manipulation');
  });
});
