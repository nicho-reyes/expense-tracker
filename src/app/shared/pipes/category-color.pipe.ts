import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'categoryColor', standalone: true })
export class CategoryColorPipe implements PipeTransform {
  transform(categoryId: string): string {
    return `var(--color-${categoryId})`;
  }
}
