# Pointer — public site

Four static pages. No build tooling, no dependencies, no server.

```
index.html            landing, links to everything
privacy.html          generated  ← rn-app/src/content/legal.ts
terms.html            generated  ← rn-app/src/content/legal.ts
delete-account.html   working self-service account deletion
assets/site.css       shared styles, dark only (the app has no light mode)
assets/i18n.js        EN/TR switch, English lives in the markup
assets/icon-*.png     favicons, cropped and scaled from rn-app/assets/pointer/app-icon.png
content/privacy-*.txt the full privacy policy the stores link to, EN + TR
build.mjs             regenerates privacy.html and terms.html
```

## Regenerating the favicons

They come from the app icon, cropped in from the square's dead margin so the pin still
reads at 16px:

```bash
sips --cropToHeightWidth 900 900 rn-app/assets/pointer/app-icon.png --out /tmp/crop.png
for s in 16 32 48 180; do sips -z $s $s /tmp/crop.png --out web/assets/icon-$s.png; done
```

## After editing the legal text

The documents live in **three** places: `LegalDocumentView.swift`, `rn-app/src/content/legal.ts`,
and here. Only the first two are hand-edited — this site is generated from the second:

```bash
node web/build.mjs
```

## Preview locally

```bash
python3 -m http.server 8000 --directory web
# http://localhost:8000
```

Account deletion works from `localhost` too: the Edge Function answers
`Access-Control-Allow-Origin: *`.

## Deploying to GitHub Pages

The app repo is private, and Pages on a private repo needs a paid plan — so the site
goes in its own **public** repo:

```bash
cd web
git init -b main
git add .
git commit -m "Pointer public site: privacy, terms, account deletion"
git remote add origin https://github.com/<user>/pointer-site.git
git push -u origin main
```

**HTTPS, not SSH.** The app repo pushes over HTTPS with the macOS keychain holding the
token, and no SSH key is set up on this machine — an `git@github.com:` remote fails with
`Permission denied (publickey)`. With the HTTPS remote the keychain answers for it and
there is nothing to log in to.

Then Settings → Pages → Source: `main`, folder `/ (root)`.
The URLs become:

| Play Console field | URL |
|---|---|
| Privacy policy | `https://<user>.github.io/pointer-site/privacy.html` |
| Account deletion | `https://<user>.github.io/pointer-site/delete-account.html` |

Keeping `web/` in the app repo as the source and pushing a copy is deliberate: the
legal text has to stay next to the client that also ships it.

## How deletion works

`delete-account.html` signs the visitor in with supabase-js and then invokes the
existing `delete-account` Edge Function — the same one the in-app button calls. Nothing
new runs on the server, so there is one deletion path, not two that can drift.

Two ways in, because one is not enough:

- **Email + password.** Fails for anyone who signed up with Google or Apple; they have
  no password.
- **Emailed 8-digit code** (`signInWithOtp`, `verifyOtp` with `type: 'email'`). Covers
  every account regardless of how it was created. **This depends on the project's email
  sender** — see below.

The page never holds a session afterwards (`persistSession: false`). It exists to end an
account; leaving a signed-in session in the browser on a shared computer would be
careless.

The anon key in the page is public by design — it is compiled into both mobile clients
and is inert without a session. Row-level security is what protects data, not secrecy.

## Known dependency: the project's email sender

`POST /auth/v1/otp` currently answers `500 "Error sending magic link email"` for a real
account. That is Supabase's wrapper around any SMTP failure, and the built-in sender it
falls back to is documented as for testing only, with a very low hourly cap. Until a
custom SMTP provider is configured, the code tab can fail and the manual `mailto:`
fallback at the bottom of the page is the one that has to work. The page reports this
honestly rather than telling the visitor to retry.
