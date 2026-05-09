import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryTileComponent } from './category-tile.component';
import { Category } from '../../../core/models/category.model';

const FOOD: Category = { id: 'food', name: 'Food', color: '#6366f1', position: 0 };

describe('CategoryTileComponent', () => {
  let component: CategoryTileComponent;
  let fixture: ComponentFixture<CategoryTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryTileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryTileComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('category', FOOD);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders color dot using var(--color-[id]) (AC4)', () => {
    const dot = fixture.nativeElement.querySelector('span[aria-hidden]') as HTMLElement;
    expect(dot.style.backgroundColor).toBe('var(--color-food)');
  });

  it('renders category name', () => {
    const name = fixture.nativeElement.querySelector('span.text-xs') as HTMLElement;
    expect(name.textContent?.trim()).toBe('Food');
  });

  it('emits tap with category id on click', () => {
    const emitted: string[] = [];
    component.tap.subscribe((id: string) => emitted.push(id));

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    btn.click();

    expect(emitted).toEqual(['food']);
  });

  it('aria-pressed is false when selected is false', () => {
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('aria-pressed is true when selected is true (AC4, ARIA)', () => {
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('applies ring-2 ring-indigo-500 classes when selected', () => {
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.classList).toContain('ring-2');
    expect(btn.classList).toContain('ring-indigo-500');
  });

  it('does not apply ring classes when not selected', () => {
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.classList).not.toContain('ring-2');
  });

  it('has aria-label matching category name', () => {
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Food');
  });
});
