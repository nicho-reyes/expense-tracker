import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BottomNavComponent } from './bottom-nav.component';

describe('BottomNavComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(BottomNavComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render 3 navigation items', () => {
    const fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
    const navLinks = fixture.nativeElement.querySelectorAll('a[routerLink]');
    expect(navLinks.length).toBe(3);
  });

  it('should have Dashboard, Entries, and Settings routes', () => {
    const fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
    const navLinks: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a[routerLink]');
    const hrefs = Array.from(navLinks).map(a => a.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/entries');
    expect(hrefs).toContain('/settings');
  });

  it('should wrap items in a semantic nav element', () => {
    const fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav).toBeTruthy();
  });

  it('should have accessible aria-labels on all nav items', () => {
    const fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
    const navLinks: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a[routerLink]');
    Array.from(navLinks).forEach(link => {
      expect(link.getAttribute('aria-label')).toBeTruthy();
    });
  });
});
