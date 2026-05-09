import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ColorPickerDialog } from './color-picker.dialog';

describe('ColorPickerDialog', () => {
  const defaultData = { categoryId: 'food', currentColor: '#6366f1' };

  function setup(currentColor = '#6366f1') {
    const closeSpy = vi.fn();
    const dialogRefStub = { close: closeSpy };

    TestBed.configureTestingModule({
      imports: [ColorPickerDialog, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefStub },
        { provide: MAT_DIALOG_DATA, useValue: { categoryId: 'food', currentColor } },
      ],
    });

    const fixture = TestBed.createComponent(ColorPickerDialog);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance, closeSpy };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('renders 12 preset swatches (AC1)', () => {
    const { fixture } = setup();
    const swatches = fixture.debugElement.queryAll(By.css('[aria-pressed]'));
    expect(swatches).toHaveLength(12);
  });

  it('currently-selected preset has ring-2 class (AC1)', () => {
    const { fixture } = setup('#6366f1');
    const swatches = fixture.debugElement.queryAll(By.css('[aria-pressed]'));
    const selectedSwatch = swatches.find(s =>
      s.nativeElement.getAttribute('aria-pressed') === 'true'
    );
    expect(selectedSwatch?.classes['ring-2']).toBe(true);
  });

  it('clicking a preset updates selectedColor (AC1)', () => {
    const { fixture, comp } = setup('#6366f1');
    const swatches = fixture.debugElement.queryAll(By.css('[aria-pressed]'));
    swatches[1].nativeElement.click();
    fixture.detectChanges();
    expect(comp.selectedColor()).toBe('#ef4444');
  });

  it('typing valid 6-digit hex sets selectedColor to normalized form (AC2)', () => {
    const { comp } = setup();
    comp.onCustomHexChange('3b82f6');
    expect(comp.selectedColor()).toBe('#3b82f6');
    expect(comp.customHexError()).toBeNull();
  });

  it('typing valid 3-digit shorthand normalizes to 6-digit (AC2)', () => {
    const { comp } = setup();
    comp.onCustomHexChange('#abc');
    expect(comp.selectedColor()).toBe('#aabbcc');
    expect(comp.customHexError()).toBeNull();
  });

  it('typing invalid hex shows error and disables Confirm (AC7)', () => {
    const { fixture, comp } = setup();
    comp.onCustomHexChange('xyz');
    fixture.detectChanges();

    expect(comp.customHexError()).not.toBeNull();

    const confirmBtn = fixture.debugElement.queryAll(By.css('button'))
      .find(b => b.nativeElement.textContent.trim() === 'Confirm');
    expect(confirmBtn?.nativeElement.disabled).toBe(true);
  });

  it('typing non-hex characters shows error message (AC7)', () => {
    const { fixture, comp } = setup();
    comp.onCustomHexChange('#gggggg');
    fixture.detectChanges();
    expect(comp.customHexError()).toBe('Enter a valid hex color (e.g. #6366f1)');
  });

  it('Confirm button calls dialogRef.close with selectedColor (AC1)', () => {
    const { comp, closeSpy } = setup();
    comp.onConfirm();
    expect(closeSpy).toHaveBeenCalledWith('#6366f1');
  });

  it('Cancel button calls dialogRef.close with null (AC8)', () => {
    const { comp, closeSpy } = setup();
    comp.onCancel();
    expect(closeSpy).toHaveBeenCalledWith(null);
  });

  it('empty custom input clears error and does not change selectedColor (AC2)', () => {
    const { comp } = setup('#6366f1');
    comp.onCustomHexChange('xyz');
    expect(comp.customHexError()).not.toBeNull();
    comp.onCustomHexChange('');
    expect(comp.customHexError()).toBeNull();
    expect(comp.selectedColor()).toBe('#6366f1');
  });

  it('initializes selectedColor from currentColor via normalizeHex (AC1)', () => {
    const { comp } = setup('#ABC');
    expect(comp.selectedColor()).toBe('#aabbcc');
  });

  it('isValidSelection is true for valid selectedColor (AC7)', () => {
    const { comp } = setup('#6366f1');
    expect(comp.isValidSelection()).toBe(true);
  });

  it('clicking preset clears customHexInput and error (AC1)', () => {
    const { comp } = setup();
    comp.onCustomHexChange('xyz');
    expect(comp.customHexError()).not.toBeNull();
    comp.onPresetClick('#ef4444');
    expect(comp.customHexInput()).toBe('');
    expect(comp.customHexError()).toBeNull();
  });
});
