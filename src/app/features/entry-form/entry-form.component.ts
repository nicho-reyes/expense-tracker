import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-entry-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<div>Entry Form — implemented in Story 2.2</div>`,
})
export class EntryFormComponent {}
