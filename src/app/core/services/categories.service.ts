import { Injectable, signal, Signal } from '@angular/core';
import { Category } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  readonly categories: Signal<Category[]> = signal([]);

  async init(): Promise<void> {
    // Implemented in Story 1.5
  }
}
