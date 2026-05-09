import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { isValidHex, normalizeHex } from '../../shared/utils/color.util';

export interface ColorPickerData {
  categoryId: string;
  currentColor: string;
}

export interface ColorSwatch {
  color: string;
  name: string;
}

const PRESET_PALETTE: readonly ColorSwatch[] = [
  { color: '#6366f1', name: 'Indigo' },
  { color: '#ef4444', name: 'Red' },
  { color: '#f59e0b', name: 'Amber' },
  { color: '#10b981', name: 'Emerald' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#8b5cf6', name: 'Violet' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#f97316', name: 'Orange' },
  { color: '#84cc16', name: 'Lime' },
  { color: '#14b8a6', name: 'Teal' },
  { color: '#9e9e9e', name: 'Grey' },
] as const;

@Component({
  selector: 'app-color-picker-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  templateUrl: './color-picker.dialog.html',
  styleUrl: './color-picker.dialog.scss',
})
export class ColorPickerDialog {
  private readonly dialogRef = inject(MatDialogRef<ColorPickerDialog, string | null>);
  readonly data = inject<ColorPickerData>(MAT_DIALOG_DATA);

  readonly presets = PRESET_PALETTE;
  readonly selectedColor = signal<string>(normalizeHex(this.data.currentColor));
  readonly customHexInput = signal<string>('');
  readonly customHexError = signal<string | null>(null);

  readonly isValidSelection = computed(
    () => isValidHex(this.selectedColor()) && this.customHexError() === null,
  );

  onPresetClick(color: string): void {
    this.selectedColor.set(normalizeHex(color));
    this.customHexInput.set('');
    this.customHexError.set(null);
  }

  onCustomHexChange(value: string): void {
    this.customHexInput.set(value);
    if (!value.trim()) {
      this.customHexError.set(null);
      return;
    }
    if (isValidHex(value)) {
      this.selectedColor.set(normalizeHex(value));
      this.customHexError.set(null);
    } else {
      this.customHexError.set('Enter a valid hex color (e.g. #6366f1)');
    }
  }

  onConfirm(): void {
    if (!this.isValidSelection()) return;
    this.dialogRef.close(this.selectedColor());
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
