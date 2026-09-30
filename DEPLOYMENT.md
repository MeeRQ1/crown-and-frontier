# Deployment

The production build is a folder of static files (`dist/`): `index.html`, one CSS file and
two JavaScript files. It has no server logic, no API keys, and makes no requests to other
sites. All asset paths are relative (`base: './'` in `vite.config.ts`), so the same build
works at a domain root, under a sub-path, inside an iframe, or unzipped anywhere.

```bash
npm ci
npm run build        # → dist/
npm run package      # → release/crown-and-frontier-web.zip (+ .sha256), index.html at the archive root
npm run verify:web   # optional: browser checks of the build and the ZIP
```

## GitHub Pages (recommended)

The workflow `.github/workflows/pages.yml` tests and builds the game on every push to `main`, then
deploys `dist/` to GitHub Pages.

One-time setup, done by the repository owner:

1. Settings → Pages → **Build and deployment → Source: GitHub Actions**.
2. Push to `main`, or run *Deploy to GitHub Pages* from the Actions tab.
3. The game is served at `https://<owner>.github.io/<repository>/` (a project sub-path, which the
   relative asset paths support).

Until Pages is enabled, the deploy job fails with a "Pages not enabled" message and nothing is
published. The repository's visibility and the decision to publish belong to the owner.

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`. It runs the type-check,
tests, build, packaging, a short AI-only campaign smoke run, and the browser verification (headless
Chromium). It uploads the ZIP and the reports as artifacts.

## Other static hosts

Upload the **contents** of `dist/` (or of the ZIP) to any web server or static host:
Netlify, Cloudflare Pages, S3 or another bucket with website hosting, an nginx or Apache folder,
or a school web space. No server routing is needed: the game is a single page.

To serve it locally or on your own machine:

```bash
npx serve dist            # or: python3 -m http.server --directory dist 8080
```

Opening `dist/index.html` directly (`file://`) is **not supported**. Browsers block module
scripts from local files; this was tested in Chromium 141, and the page shows an explanation
instead of hanging.

## HTML5 game portals and ZIP uploads

`release/crown-and-frontier-web.zip` holds only the production files, with `index.html` at the
archive root. That is the layout most portals that accept HTML5 uploads expect. No particular
portal was targeted, and no portal SDK or advertising is integrated. Before submitting to a
portal, check its current requirements (file limits, embed size, content rating, and whether
saves in its iframe may be partitioned or blocked).

## Embedding in an iframe

```html
<iframe src="https://<owner>.github.io/crown-and-frontier/" width="960" height="600"
        style="border:0" allow="autoplay; fullscreen" title="Crown & Frontier"></iframe>
```

The game fills its container and follows resizes. Mouse-wheel zoom, drags and touch gestures on
the map are captured, so they don't scroll the host page. The game pauses and autosaves when the tab
is hidden. It never requests fullscreen. Browsers may partition or block storage inside third-party
iframes. The game then warns that saves last only for the session, and Export/Import still works.

## Browser compatibility

| Environment | Status |
|---|---|
| Chromium 141 (Playwright, headless), 1366×768 and 1280×800 desktop | **Verified** by `npm run verify:web`: site root, project sub-path, unpacked ZIP, iframe host page, hidden-tab pause and autosave, keyboard, save/load, export/import, damaged import, blocked storage, performance probe |
| Chromium 141, emulated phone (390×780, touch, DPR 2) | **Verified**: tap selection, no horizontal page scroll, no errors |
| Chrome / Edge on desktop, ChromeOS (Chromebooks) | Expected to work (same engine); **not tested on real hardware** |
| Firefox, Safari (macOS / iOS), Android browsers | **Untested** |

The game needs ES2020, Canvas 2D, Pointer Events and ResizeObserver. It uses no WebGL or
WebGPU. IndexedDB is preferred for saves, with a localStorage fallback.

## Performance

These figures come from the latest `reports/web-verification.md` and `reports/ai-campaigns.md`,
measured in this development container: Linux, Node 22, headless Chromium with software
rendering. They are **not** Chromebook measurements.

- Map drawing averages about 1–2 ms per frame at 1366×768, and the page holds 60 fps while
  simulating at the fastest speed.
- One simulation week (99 provinces, 9 realms, AI included) takes about 4 ms on average in Node.
  Rare worst-case weeks took 35–120 ms across batches. That is far below the 1-second interval at normal speed and the
  167 ms interval at the fastest speed.
- The JavaScript heap stays at about 10 MB in the browser.
- The bundle is about 170 KB gzipped (the JavaScript includes the map geometry). The first
  interaction (the main menu) appears within about 0.1 s when served locally.
