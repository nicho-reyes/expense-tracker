import { Injectable, signal, Signal } from '@angular/core';
import { LocalEntry } from '../models/entry.model';

@Injectable({ providedIn: 'root' })
export class EntriesService {
  readonly entries: Signal<LocalEntry[]> = signal([]);

  // Implemented in Story 2.1
}
