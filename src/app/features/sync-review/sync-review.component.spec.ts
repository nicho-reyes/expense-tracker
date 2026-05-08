import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SyncReviewComponent } from './sync-review.component';

describe('SyncReviewComponent', () => {
  let component: SyncReviewComponent;
  let fixture: ComponentFixture<SyncReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SyncReviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SyncReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
