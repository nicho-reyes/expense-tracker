import { Directive, output, HostListener } from '@angular/core';

@Directive({
  selector: '[appLongPress]',
  standalone: true,
})
export class LongPressDirective {
  readonly longPress = output<void>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('pointerdown')
  onPointerDown(): void {
    this.timer = setTimeout(() => this.longPress.emit(), 600);
  }

  @HostListener('pointerup')
  @HostListener('pointerleave')
  onPointerUp(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
