import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, EMPTY } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets/test';
const NON_SHEETS_URL = 'https://example.com/api/data';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let authSpy: {
    getAccessToken: ReturnType<typeof vi.fn>;
    handleUnauthorized: ReturnType<typeof vi.fn>;
    isReauthPending: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authSpy = {
      getAccessToken: vi.fn().mockReturnValue('test-token'),
      handleUnauthorized: vi.fn().mockReturnValue(EMPTY),
      isReauthPending: vi.fn().mockReturnValue(false),
      isAuthenticated: vi.fn().mockReturnValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
  });

  it('adds Authorization header for Sheets API requests', () => {
    http.get(SHEETS_URL).subscribe();
    const req = controller.expectOne(SHEETS_URL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({});
  });

  it('does not add Authorization header for non-Sheets URLs', () => {
    http.get(NON_SHEETS_URL).subscribe();
    const req = controller.expectOne(NON_SHEETS_URL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('calls handleUnauthorized() on 401 from Sheets API', () => {
    authSpy.handleUnauthorized.mockReturnValue(EMPTY);
    http.get(SHEETS_URL).subscribe({ error: () => {} });
    const req = controller.expectOne(SHEETS_URL);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    expect(authSpy.handleUnauthorized).toHaveBeenCalled();
  });

  it('retries the request with new token when handleUnauthorized returns a token', () => {
    authSpy.handleUnauthorized.mockReturnValue(of('new-token'));
    const results: any[] = [];
    http.get(SHEETS_URL).subscribe({ next: (r) => results.push(r) });

    // first attempt → 401
    const first = controller.expectOne(SHEETS_URL);
    first.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    // retry with new token
    const retry = controller.expectOne(SHEETS_URL);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush({ data: 'ok' });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ data: 'ok' });
  });

  it('does NOT call handleUnauthorized() on non-401 HTTP errors', () => {
    let errorReceived = false;
    http.get(SHEETS_URL).subscribe({ error: () => { errorReceived = true; } });
    const req = controller.expectOne(SHEETS_URL);
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    expect(authSpy.handleUnauthorized).not.toHaveBeenCalled();
    expect(errorReceived).toBe(true);
  });

  it('completes without error when handleUnauthorized returns EMPTY (redirect path)', () => {
    authSpy.handleUnauthorized.mockReturnValue(EMPTY);
    let completed = false;
    let errored = false;
    http.get(SHEETS_URL).subscribe({
      complete: () => { completed = true; },
      error: () => { errored = true; },
    });
    const req = controller.expectOne(SHEETS_URL);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    // EMPTY completes without emitting — original error is NOT re-emitted
    expect(errored).toBe(false);
    expect(completed).toBe(true);
  });

  it('propagates non-401 errors unchanged', () => {
    let capturedError: any;
    http.get(SHEETS_URL).subscribe({ error: (e) => { capturedError = e; } });
    const req = controller.expectOne(SHEETS_URL);
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    expect(capturedError.status).toBe(403);
  });
});
