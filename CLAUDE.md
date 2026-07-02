# HTTP-Buttons — ZeppOS app

A ZeppOS (Zepp OS) mini-program: a grid of configurable buttons that fire HTTP
requests from the watch, with results shown on-device. Watch↔phone messaging
goes through `@zeppos/zml`; the settings app (`setting/`) edits the JSON config,
the side service (`app-side/`) proxies requests and the image pipeline, and the
page (`page/`) renders the buttons and results.

## ZeppOS API reference

Zepp OS API docs, optimized for LLM consumption, are vendored once for all the
sibling ZeppOS projects under `../_shared/`. Consult it before touching UI
(`@zos/ui`, `px()`, widgets), lifecycle (`App`/`Page`/`onDestroy` cleanup),
sensors, fs, or `@zos/*` APIs — don't answer ZeppOS API questions from memory.

@../_shared/zeppos-ai-doc/llms-full.txt

## Project conventions

- **Layouts are per-platform**: `page/index.[pf].layout.js` resolves to
  `.r`/`.s` via `zosLoader:`. Keep the two exports (`.r` round, `.s` square) in
  sync when editing shared exports like `LOADING_*_WIDGET`.
- **`px()` is effectively identity here**: `app.json` sets `dw` equal to each
  platform's real resolution, so screen adaptation relies on device-relative
  math (`getDeviceInfo()` fractions), not `px()` scaling. Fixed-asset sizes
  (e.g. `LOADING_ANIM_SIZE`) are intrinsic PNG sizes and must NOT be scaled.
- **Create widgets in `build()`, never `onInit()`**; clean up widgets, the
  session cache, toasts and the image overlay in `onDestroy()` (null-guarded).
