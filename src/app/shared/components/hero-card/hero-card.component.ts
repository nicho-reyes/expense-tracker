import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-hero-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content />`,
})
export class UheroUcardComponent {}
