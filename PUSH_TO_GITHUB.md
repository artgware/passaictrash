# Pushing the project to github.com/artgware/passaictrash

I can't authenticate to GitHub for you from this sandbox, so this guide gives
you three paths. Pick whichever is easiest. All three put exactly the same
files in your repo.

Everything you need is in:

- `github-repo/` (folder) — the ready-to-push repo contents
- `passaictrash-github.zip` — the same contents zipped for web upload

---

## Option A — Drag-and-drop in the GitHub web UI (no CLI)

This is the fastest path if your repo is empty (or only has a README).

1. Download `passaictrash-github.zip`.
2. Unzip it locally — you'll get a folder called `ghrepo-staging` containing
   `index.html`, `README.md`, etc.
3. Open **https://github.com/artgware/passaictrash** in a browser.
4. Click **"Add file" → "Upload files"** (if the repo has no files, GitHub
   shows a direct drag-and-drop zone on the main page).
5. Open the unzipped folder in Finder / Explorer, **select all files**
   (⌘A / Ctrl+A — don't drag the folder itself; drag its contents), and drop
   them into GitHub's upload area.
6. Scroll down, write a commit message like `Initial commit: Passaic Debris
   Tracker`, and click **Commit changes**.

The dotfiles (`.gitignore`, `.nojekyll`) will upload too — GitHub accepts them.

---

## Option B — Clone the repo and copy files in (CLI)

Best if the repo already has commits (e.g. a README GitHub auto-generated).

```bash
# 1. Clone your existing repo
git clone https://github.com/artgware/passaictrash.git
cd passaictrash

# 2. Copy the prepared files INTO the cloned repo
#    Replace the path below with wherever you saved github-repo on your Mac
cp -R /path/to/github-repo/. .

# 3. Commit & push
git add .
git commit -m "Add Passaic Debris Tracker source"
git push origin main
```

If `git push` asks for authentication, use a **personal access token** as the
password (GitHub stopped accepting account passwords in 2021). Create one at
https://github.com/settings/tokens — scope `repo` is enough.

---

## Option C — Push the already-initialized repo (CLI, fastest)

The `github-repo/` folder already has `git init` and one commit
(`Initial commit: Passaic Debris Tracker`, SHA `5d47f54`). You just need to
wire up the remote and push.

```bash
# Move the folder to wherever you keep projects
cd /path/to/github-repo

# Add GitHub as the remote
git remote add origin https://github.com/artgware/passaictrash.git

# If your repo is EMPTY on GitHub, this is all you need:
git push -u origin main

# If your repo already has commits (e.g. a README), merge histories first:
git pull origin main --allow-unrelated-histories --no-edit
git push -u origin main
```

Same PAT requirement as Option B.

### SSH instead of HTTPS

If you use SSH keys with GitHub, swap the remote URL:

```bash
git remote set-url origin git@github.com:artgware/passaictrash.git
git push -u origin main
```

---

## After the push — optional: turn on GitHub Pages

If you want the repo to also serve the site at
`https://artgware.github.io/passaictrash/`:

1. GitHub repo → **Settings → Pages**.
2. **Source**: Deploy from a branch.
3. **Branch**: `main`, folder `/ (root)`. **Save**.

A minute later the site loads at the artgware.github.io URL. The
`.nojekyll` file is already in the bundle so GitHub won't try to Jekyll-process
it. **One caveat**: `service-worker.js` and `manifest.webmanifest` use absolute
paths like `/icon-192.png` that assume the site is at the domain root (as it
is on Netlify at passaictrash.com). On GitHub Pages the site lives under
`/passaictrash/`, so the PWA offline cache and icon resolution will 404. The
page itself still loads and works — only the installable-PWA features are
affected. If you want those to work on GitHub Pages too, tell me and I'll
rewrite the paths to relative.

Your Netlify site at **passaictrash.com** keeps working exactly as before
regardless of whether GitHub Pages is enabled.

---

## File inventory

```
github-repo/
├── .gitignore              # Node / OS / IDE ignores
├── .nojekyll               # Tells GitHub Pages not to Jekyll-process the repo
├── LICENSE                 # MIT
├── PWA_DEPLOY.md           # Netlify + mobile install instructions
├── README.md               # Project overview
├── SETUP.md                # Apps Script backend setup
├── _headers                # Netlify MIME-type config
├── _redirects              # Netlify / → /passaic-debris-tracker.html
├── apps-script-webhook.gs  # Paste into Google Apps Script
├── icon-192.png
├── icon-512.png
├── icon-maskable-512.png
├── index.html              # Same content as passaic-debris-tracker.html
├── manifest.webmanifest
├── passaic-debris-tracker.html
└── service-worker.js
```
