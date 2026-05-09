import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-center text-center p-8 gap-3">
      <mat-icon class="text-5xl text-zinc-400" [fontIcon]="icon()"></mat-icon>
      <h2 class="text-lg font-medium">{{ title() }}</h2>
      <p class="text-sm text-zinc-500">{{ message() }}</p>
      @if (ctaLabel(); as label) {
        <button mat-flat-button color="primary" (click)="ctaClick.emit()">{{ label }}</button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly ctaLabel = input<string | null>(null);
  readonly ctaClick = output<void>();
}
