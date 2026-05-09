import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { QuickAddSheetComponent } from '../entry-form/entry-form.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly bottomSheet = inject(MatBottomSheet);

  @ViewChild('fabRef', { static: true }) fabRef!: ElementRef<HTMLButtonElement>;

  readonly sheetOpen = signal(false);

  onOpenQuickAdd(): void {
    this.sheetOpen.set(true);
    const ref = this.bottomSheet.open(QuickAddSheetComponent, {
      autoFocus: false,
      panelClass: 'quick-add-sheet',
    });
    ref.afterDismissed().subscribe(() => {
      this.sheetOpen.set(false);
      this.fabRef.nativeElement.focus();
    });
  }
}
