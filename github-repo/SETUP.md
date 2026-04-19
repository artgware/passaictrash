# Passaic Debris Tracker — Shared Backend Setup

This adds a Google Sheet as the shared club-wide log so every rower, on every device, sees the same reports.

You'll do this **once**, then share one URL with the whole club.

---

## Files in this bundle

| File | Purpose |
|---|---|
| `passaic-debris-tracker.html` | The website itself. Embed in Squarespace or open directly. |
| `apps-script-webhook.gs` | Google Apps Script code that turns a Google Sheet into the backend. |
| `SETUP.md` | This file. |

---

## Part 1 — Create the shared Google Sheet (3 min)

1. Go to https://sheets.google.com → **Blank** to create a new spreadsheet.
2. Rename it something like **"Passaic Debris Log"**.
3. In the menu bar: **Extensions → Apps Script**. A new tab opens with a code editor.
4. Delete the placeholder `function myFunction() {}` so the editor is empty.
5. Open `apps-script-webhook.gs` (in this bundle), copy **everything**, and paste it into the Apps Script editor.
6. Hit **Save** (💾 icon, or Ctrl/Cmd + S). When prompted, name the project **"Passaic Debris Webhook"**.

## Part 2 — Deploy as a Web App (2 min)

1. In the Apps Script editor, click **Deploy → New deployment** (top right).
2. Click the gear icon ⚙ next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `Passaic debris webhook v1`
   - **Execute as:** `Me (your-email@example.com)`
   - **Who has access:** `Anyone` ← important, otherwise the website can't reach it
4. Click **Deploy**.
5. Google will ask for authorization the first time:
   - Click **Authorize access** → choose your Google account.
   - You'll see a "Google hasn't verified this app" warning. That's expected because it's your own personal script. Click **Advanced** → **Go to Passaic Debris Webhook (unsafe)** → **Allow**.
6. Copy the **Web app URL** that appears. It looks like:
   ```
   https://script.google.com/macros/s/AKfycbz.../exec
   ```
   Save this somewhere — you'll paste it into the website next.

## Part 3 — Connect the website (30 sec)

1. Open `passaic-debris-tracker.html` in your browser (or visit passaictrash.com once it's deployed).
2. Click the **⚙ Settings** button in the header.
3. Paste the Web app URL into the field.
4. Optionally check **Auto-pull every 60 seconds** so everyone sees new reports without clicking Sync.
5. Click **Test Connection** → you should see "✓ Reached backend. 0 reports in sheet."
6. Click **Save**.

The pill in the header should turn green: **☁ Synced**.

## Part 4 — Share with the club

The webhook URL stays a secret on each rower's browser — they don't enter it themselves.

Two options:

**Option A (recommended):** Bake the URL into the page so rowers just visit passaictrash.com and start logging. In `passaic-debris-tracker.html`, find this line near the top of the script section:

```js
const WEBHOOK_KEY = "passaic.webhookUrl.v1";
```

Right below the `loadReports`/`saveReports` block, add a one-time bootstrap line:

```js
if (!localStorage.getItem(WEBHOOK_KEY)) {
  localStorage.setItem(WEBHOOK_KEY, "https://script.google.com/macros/s/YOUR_URL/exec");
}
```

Now every visitor is auto-connected.

**Option B:** Send each rower the Settings URL once, they paste it themselves. Useful if you want to limit who can post.

---

## Re-deploying after you change the script

If you edit `apps-script-webhook.gs` later (e.g. to add fields):

1. Apps Script editor → **Deploy → Manage deployments**.
2. Click the pencil ✏ icon on your existing deployment.
3. **Version:** "New version" → write a note → **Deploy**.

The URL stays the same, so the website keeps working.

---

## Troubleshooting

**"Sync error: Failed to fetch"**
Most often: the deployment's "Who has access" isn't set to "Anyone". Go to Manage deployments and confirm.

**"Sync error: Unexpected token < in JSON"**
Means the URL returned an HTML login page instead of JSON. Same fix — set access to "Anyone".

**Reports save locally but not to the sheet**
Open the browser DevTools (F12) → Network tab → save a report → look for the `/exec` request. If it's red/blocked, it's usually a CORS or access issue. The site uses `Content-Type: text/plain` specifically to avoid CORS preflight, so as long as access is "Anyone", it should work.

**Numbers in the sheet show as text or dates show as numbers**
That's just Sheets formatting — pick the column → Format → Number. The website parses everything correctly regardless.

**A rower wants to delete their bad report**
For now: open the Google Sheet directly and delete the row, then click **☁ Sync Now** in the website. (We can add an in-app delete in v2.)

---

## Embedding in Squarespace (passaictrash.com)

The cleanest path:

1. Host `passaic-debris-tracker.html` somewhere static and free:
   - **Netlify Drop:** drag-and-drop the file at https://app.netlify.com/drop. You get a URL instantly.
   - Or **GitHub Pages**: push to a repo, enable Pages.
2. In Squarespace, edit the page that should show the tracker.
3. Add a **Code Block** and paste:
   ```html
   <iframe
     src="https://YOUR-NETLIFY-URL.netlify.app/passaic-debris-tracker.html"
     style="width:100%; height:90vh; border:0; border-radius:8px;"
     allow="geolocation"
     loading="lazy">
   </iframe>
   ```
4. Save the page. Point the **passaictrash.com** domain at the Squarespace site (Settings → Domains).

If you prefer to skip Netlify entirely and your Squarespace plan allows raw `<script>` tags (Business plan and above), you can paste the entire HTML into a Code Block — but the iframe path is more reliable across plans and editor versions.

---

## What gets stored in the sheet

Each report becomes one row with these columns:

`id`, `ts`, `zoneId`, `zoneName`, `level`, `type`, `rower`, `notes`, `lat`, `lng`, `tide_level_ft`, `tide_phase`, `flow_cfs`

You can pivot, chart, or analyze that data directly in Sheets — for example, build a pivot table of "average level by zone by hour of day", or correlate `level` against `flow_cfs` to test the hypothesis that high flow = more upstream debris.
