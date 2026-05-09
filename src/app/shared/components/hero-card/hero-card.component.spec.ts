import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HeroCardComponent } from './hero-card.component';

describe('HeroCardComponent', () => {
  let fixture: ComponentFixture<HeroCardComponent>;

  async function create(total: number, month: string, isLoading = false) {
    await TestBed.configureTestingModule({
      imports: [HeroCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroCardComponent);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('month', month);
    fixture.componentRef.setInput('isLoading', isLoading);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders total formatted as CHF currency', async () => {
    await create(77.5, '2026-05');
    const h2 = fixture.debugElement.query(By.css('h2'));
    expect(h2.nativeElement.textContent).toContain('77.50');
  });

  it('renders total with text-4xl font-bold classes', async () => {
    await create(100, '2026-05');
    const h2 = fixture.debugElement.query(By.css('h2'));
    expect(h2.nativeElement.classList).toContain('text-4xl');
    expect(h2.nativeElement.classList).toContain('font-bold');
  });

  it('does not set aria-busy when not loading', async () => {
    await create(50, '2026-05', false);
    const section = fixture.debugElement.query(By.css('section'));
    expect(section.nativeElement.getAttribute('aria-busy')).toBeNull();
  });

  it('renders skeleton with aria-busy="true" when loading', async () => {
    await create(50, '2026-05', true);
    const section = fixture.debugElement.query(By.css('section'));
    expect(section.nativeElement.getAttribute('aria-busy')).toBe('true');
  });

  it('skeleton has 40px height when loading', async () => {
    await create(50, '2026-05', true);
    const skeleton = fixture.debugElement.query(By.css('[style*="40px"]'));
    expect(skeleton).toBeTruthy();
    expect(skeleton.nativeElement.style.height).toBe('40px');
  });

  it('does not render total text when loading', async () => {
    await create(50, '2026-05', true);
    const h2 = fixture.debugElement.query(By.css('h2'));
    expect(h2).toBeNull();
  });

  it('renders total text and removes skeleton when not loading', async () => {
    await create(50, '2026-05', false);
    const h2 = fixture.debugElement.query(By.css('h2'));
    const skeleton = fixture.debugElement.query(By.css('[style*="40px"]'));
    expect(h2).toBeTruthy();
    expect(skeleton).toBeNull();
  });

  it('renders formatted month label as section subtitle', async () => {
    await create(50, '2026-05');
    const span = fixture.debugElement.query(By.css('span'));
    expect(span.nativeElement.textContent).toContain('May 2026');
  });

  it('sets dynamic aria-label on section including month name', async () => {
    await create(50, '2026-05');
    const section = fixture.debugElement.query(By.css('section'));
    expect(section.nativeElement.getAttribute('aria-label')).toContain('May 2026');
  });
});
