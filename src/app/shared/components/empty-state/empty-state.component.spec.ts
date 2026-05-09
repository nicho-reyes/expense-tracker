import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders title and message', () => {
    fixture.componentRef.setInput('title', 'No expenses yet');
    fixture.componentRef.setInput('message', 'Tap + to log your first expense.');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('No expenses yet');
    expect(el.querySelector('p')?.textContent?.trim()).toBe('Tap + to log your first expense.');
  });

  it('does not render CTA button when ctaLabel is null', () => {
    fixture.componentRef.setInput('title', 'Empty');
    fixture.componentRef.setInput('message', 'Nothing here.');
    fixture.componentRef.setInput('ctaLabel', null);
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn).toBeNull();
  });

  it('renders CTA button when ctaLabel is set', () => {
    fixture.componentRef.setInput('title', 'Empty');
    fixture.componentRef.setInput('message', 'Nothing here.');
    fixture.componentRef.setInput('ctaLabel', 'Add expense');
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn).not.toBeNull();
    expect(btn.nativeElement.textContent.trim()).toContain('Add expense');
  });

  it('CTA click emits ctaClick output', () => {
    fixture.componentRef.setInput('title', 'Empty');
    fixture.componentRef.setInput('message', 'Nothing here.');
    fixture.componentRef.setInput('ctaLabel', 'Add expense');
    fixture.detectChanges();

    const emitSpy = vi.spyOn(fixture.componentInstance.ctaClick, 'emit');

    const btn = fixture.debugElement.query(By.css('button'));
    btn.triggerEventHandler('click', null);
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });
});
