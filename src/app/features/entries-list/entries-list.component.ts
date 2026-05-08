import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-entries-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<div>Entries List — implemented in Story 2.3</div>`,
})
export class EntriesListComponent {}
