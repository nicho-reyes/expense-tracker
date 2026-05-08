# Platform Requirements

## Browser Support

**Primary targets (must work flawlessly):**
- iOS Safari 16+ (iPhone, the primary mobile device)
- Android Chrome 110+

**Secondary targets (should work, no dedicated optimization):**
- Desktop Chrome (latest)
- Desktop Safari (latest)

No IE, no legacy browser support. This is a personal tool — the user controls the browser.

## Responsive Design

- **Mobile-first layout** — base breakpoint is 360px width; all core interactions designed for one-handed mobile use
- **Desktop as secondary** — wider viewports get a comfortable reading layout; no dedicated desktop-optimized design effort required
- **PWA installability** — the app is installable as a home screen app on iOS and Android via standard PWA manifest and service worker. Once installed, it behaves like a native app: full-screen, no browser chrome, persistent icon.

## Performance Targets

Performance targets are defined in NFR-P1 through NFR-P5. All targets measured on a mid-range device on 4G.

## Accessibility

Best-effort only. No WCAG compliance target. Single-user personal tool — Nick controls the device and environment. Standard HTML semantics, readable font sizes (min 16px body), and sufficient color contrast as a baseline; no formal audit or compliance required.

## Implementation Considerations

- **Service worker** — required for offline support (queued entries, cached dashboard) and PWA installability. Must handle cache invalidation on app update.
- **Viewport meta tag** — `width=device-width, initial-scale=1` required. No `user-scalable=no` (accessibility baseline).
- **Deep linking** — the drill-down view (category × month) must be directly linkable/bookmarkable so the browser back button works naturally.
- **No SSR required** — pure SPA. Static hosting (GitHub Pages, Netlify, or self-hosted nginx) is sufficient.
