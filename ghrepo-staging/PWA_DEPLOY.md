# Deploying the Passaic Debris PWA

You now have a real installable mobile app. This guide covers redeploying to Netlify and what rowers do on their phone to install it.

## Files in this bundle

| File | Required? | Purpose |
|---|---|---|
| `passaic-debris-tracker.html` | ✅ | The app itself. Leave at site root, or make it `index.html`. |
| `manifest.webmanifest` | ✅ | Tells iOS/Android "this is an installable app." |
| `service-worker.js` | ✅ | Offline support, caching, background sync, push notifications. |
| `icon-192.png` | ✅ | Home-screen icon (smaller). |
| `icon-512.png` | ✅ | Home-screen icon (larger). |
| `icon-maskable-512.png` | ✅ | Android adaptive icon (safe-area padded). |
| `apps-script-webhook.gs` | ✅ | Updated with photo-upload and schema migration. |
| `PWA_DEPLOY.md` | — | This file. |

## Step 1 — Redeploy everything to Netlify

The PWA requires all six runtime files to be served from the **same origin** — the service worker can't be cached from a CDN mirror.

1. Go to https://app.netlify.com/drop.
2. Drag the entire outputs folder (HTML + manifest + service-worker.js + 3 PNGs) onto the drop zone. It should re-deploy to the existing site.
3. Alternatively, in the Netlify dashboard → your site → **Deploys** → drag-and-drop the folder onto the "Drag and drop your site output folder here" area.
4. In Netlify → **Site configuration → Build & deploy → Post processing**, confirm **"Pretty URLs"** is **off** or that `passaic-debris-tracker.html` can be served directly. (It should work by default.)

**Important — rename or redirect:** Since the HTML file is called `passaic-debris-tracker.html` but the manifest and service worker reference `/` as the start URL, either:
- Rename the HTML file to `index.html` before uploading, **or**
- Add a `_redirects` file in the folder with: `/  /passaic-debris-tracker.html  200`

The `_redirects` approach lets you keep the descriptive filename. Create a file called `_redirects` (no extension) in the outputs folder with just that one line, then re-upload.

## Step 2 — Redeploy the Apps Script

The Apps Script was updated to handle photo uploads and to add a `photo_url` column.

1. Open the Apps Script editor from your Google Sheet → Extensions → Apps Script.
2. Replace the old code with the contents of `apps-script-webhook.gs`.
3. Click **Deploy → Manage deployments → ✏ pencil icon → Version: New version → Deploy**.
4. First time only: you'll be asked to re-authorize because the script now needs Drive access (for photo uploads). Click through the "unsafe" warning as before.

The next time a report is saved with a photo, a `Passaic Debris Photos` folder will be auto-created in your Google Drive root and the photo uploaded there. The Drive URL goes into the sheet's `photo_url` column. Photos are world-readable via link but unlisted.

## Step 3 — Install on iPhone

1. Visit **https://passaictrash.com** in **Safari** (not Chrome on iOS — the Add to Home Screen flow only works in Safari).
2. Tap the **Share** button (the square with an up arrow at the bottom).
3. Scroll down → tap **Add to Home Screen**.
4. Tap **Add** in the top-right.

The app now appears on the home screen as "Passaic Debris" with the custom icon, launches fullscreen (no browser chrome), and works offline. The in-app banner ("To install: tap Share → Add to Home Screen") appears automatically for iOS visitors.

## Step 4 — Install on Android

1. Visit **https://passaictrash.com** in **Chrome** or **Edge**.
2. The install banner appears automatically at the bottom. Tap **Install**.

(Alternatively, tap the ⋮ menu → **Install app** / **Add to Home Screen**.)

The app installs to the app drawer and home screen exactly like a Play Store app. Long-pressing the icon shows a **Quick Report** shortcut (manifest-defined) that opens the app straight to a GPS-located report modal.

## What rowers see

**First launch:** permission prompts for location (optional, skip-able) and notifications (optional, skip-able). Either can be re-granted later in device settings.

**Tapping a zone:** opens the existing report modal plus a "📷 Add photo" button that opens the phone's camera directly.

**Using the 📍 Quick Report button** (added to the header): the app fetches GPS once, figures out which zone the rower is nearest, and opens the modal pre-zoned.

**Saving offline:** reports save locally. The sync pill turns amber and says "Synced · 2 pending". When signal returns, the service worker fires a background-sync event and those reports push automatically — the rower doesn't even need to re-open the app.

**New high-severity reports:** when another rower logs a Level 4 or 5 in any zone, anyone with the app installed and notifications enabled gets a banner alert (works on Android immediately, works on iOS 16.4+ when the app is installed to the home screen).

## Verifying it worked

Open Chrome DevTools → **Application** panel → **Service Workers**. You should see `service-worker.js` registered with status "activated and running." Under **Manifest**, you should see the name, icons, start URL. Under **Cache Storage**, you should see a `passaic-v3` cache with the app shell files.

Lighthouse audit (DevTools → Lighthouse → PWA category) should score 90+.

## If something goes wrong

**"Add to Home Screen" missing on iOS:** you're probably in Chrome on iOS — switch to Safari. Or the `manifest.webmanifest` MIME type is wrong on Netlify. Add to `netlify.toml` or `_headers`:
```
/manifest.webmanifest
  Content-Type: application/manifest+json
```

**Install banner never appears on Android:** Chrome's installability heuristics require HTTPS (you have that), a valid manifest, a registered service worker, and at least one 192×192 icon. If all four are true, just wait — Chrome sometimes waits for a second visit before showing the prompt.

**Photos aren't uploading:** open your Apps Script editor → **Executions** tab to see the error. The most common cause is that the re-deploy didn't grant Drive permission — you need to re-authorize after pasting the new code.

**Notifications don't fire on iOS:** they only work on iOS 16.4 or later **and only when the app is installed to the home screen**. Safari tab notifications are not supported by Apple.

## Wrapping in Capacitor later (optional)

If you decide to pursue App Store + Play Store submission after this is working:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Passaic Debris" com.passaictrash.app --web-dir=.
npx cap add ios
npx cap add android
npx cap copy
npx cap open ios       # builds in Xcode
npx cap open android   # builds in Android Studio
```

Because this is already a working PWA, Capacitor wraps it with zero code changes. You submit the Xcode archive to App Store Connect and the Android AAB to Google Play. Apple review is typically 24-48 hours now (used to be weeks), Google is near-instant for updates.
