import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AddCategoryDialogComponent } from './add-category-dialog.component';
import { CategoriesService } from '../../core/services/categories.service';

describe('AddCategoryDialogComponent', () => {
  let component: AddCategoryDialogComponent;
  let categoriesSpy: { create: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    categoriesSpy = { create: vi.fn().mockResolvedValue({ id: 'new-id', name: 'Test', color: '#6366f1', position: 1 }) };
    dialogRefSpy = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AddCategoryDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: CategoriesService, useValue: categoriesSpy },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    });

    const fixture = TestBed.createComponent(AddCategoryDialogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => vi.restoreAllMocks());

  it('Save is disabled when name is empty', () => {
    component.nameInput.set('');
    expect(component.isSaveDisabled()).toBe(true);
  });

  it('Save is disabled when name is whitespace only', () => {
    component.nameInput.set('   ');
    expect(component.isSaveDisabled()).toBe(true);
  });

  it('Save is enabled when name has non-whitespace characters', () => {
    component.nameInput.set('Groceries');
    expect(component.isSaveDisabled()).toBe(false);
  });

  it('duplicate-name validation surface — inline error set, dialog stays open', async () => {
    component.nameInput.set('Groceries');
    categoriesSpy.create.mockRejectedValue({
      type: 'CATEGORY_NAME_DUPLICATE',
      name: 'Groceries',
    });

    await component.onSave();

    expect(component.inlineError()).toContain('already exists');
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('valid name — categoriesService.create called, dialog closes with true', async () => {
    component.nameInput.set('Groceries');

    await component.onSave();

    expect(categoriesSpy.create).toHaveBeenCalledWith({ name: 'Groceries' });
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('onCancel closes dialog with false', () => {
    component.onCancel();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });

  it('onNameChange clears inline error', () => {
    component.inlineError.set('some error');
    component.onNameChange('new text');
    expect(component.inlineError()).toBeNull();
  });
});
