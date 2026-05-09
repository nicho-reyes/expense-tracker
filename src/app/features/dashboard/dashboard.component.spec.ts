import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let bottomSheetSpy: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    bottomSheetSpy = {
      open: vi.fn().mockReturnValue({
        afterDismissed: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: MatBottomSheet, useValue: bottomSheetSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('FAB has aria-label="Add expense" (AC15)', () => {
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]');
    expect(fab).toBeTruthy();
  });

  it('FAB is visible (not hidden) before sheet opens (AC12)', () => {
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]') as HTMLElement;
    expect(fab.style.visibility).not.toBe('hidden');
  });

  it('FAB visibility becomes hidden when sheetOpen is true (AC12)', () => {
    component.sheetOpen.set(true);
    fixture.detectChanges();
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]') as HTMLElement;
    expect(fab.style.visibility).toBe('hidden');
  });

  it('onOpenQuickAdd opens the bottom sheet (AC1)', () => {
    component.onOpenQuickAdd();
    expect(bottomSheetSpy.open).toHaveBeenCalled();
  });
});
