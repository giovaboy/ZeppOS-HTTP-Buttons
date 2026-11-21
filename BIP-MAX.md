# HTTP-Buttons on the Amazfit Bip Max

This branch (`bip-max-port`) makes the app work on the Bip Max (deviceSource 11206915, 432 × 514 square screen, Zepp OS 6, API_LEVEL 4.4).

## What was wrong

1. **Layout scaled twice.** The layouts compute every position from `getDeviceInfo()`, which is already in real pixels, and then pass it through `px()` from `@zos/utils`. `px()` multiplies by *device width ÷ design width*. The square target's design width is 390 (Bip 6), so on the 432-wide Bip Max everything came out ~11 % too big. Swiped pages drifted about 55 px further off each time, and the button animations and toasts landed off their spot.
   *Fix:* the two page layouts and `utils/button-loader.js` now use a local `px` that only rounds. On 390- and 480-wide watches (Bip 6, Active Max) `px()` already did nothing, so they're unchanged. Other widths, like the 466 px Active 2, also lose a small drift.

2. **Shortcut card.** Zepp's device list marks the Bip Max as not supporting shortcut cards (app widgets), and the app bundles one.
   *Fix:* `app.json` has a second target, `bipmax.s`, matched by the Bip Max's deviceSource. It has the same pages, phone service and settings, but no card, and its design width is 432. A target that names a deviceSource takes priority over the shape-only `default` target, so every other watch builds exactly as before. `assets/bipmax.s` is a copy of `assets/default.s`.

## Installing it on your watch

The Zepp store only offers an app on the watches its developer ticks when publishing. Until the store version supports the Bip Max, install this build yourself:

```bash
npm i -g @zeppos/zeus-cli
npm install
zeus login
zeus preview        # pick "Amazfit Bip Max", then scan the QR code
```

Scan the QR code from **Zepp app → Profile → Settings → Developer Mode → Scan**. Developer Mode appears after you tap the Zepp logo 7 times in **Profile → Settings → About**.

If `zeus preview` doesn't list the Bip Max, update the CLI (`npm i -g @zeppos/zeus-cli@latest`). If it refuses the appId because the app isn't on your account, create an app in the [Zepp developer console](https://console.zepp.com) and put its appId in `app.json`. Your buttons live in that app's own settings, so you'd paste your config in through **Configuration (raw JSON)**.

To test the layout without the watch: `zeus dev` with the Bip Max selected in the Zepp OS Simulator.
