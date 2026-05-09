import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-category-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-tile.component.html',
  styleUrl: './category-tile.component.scss',
})
export class CategoryTileComponent {
  readonly category = input.required<Category>();
  readonly selected = input<boolean>(false);
  readonly tap = output<string>();

  onClick(): void {
    this.tap.emit(this.category().id);
  }
}
