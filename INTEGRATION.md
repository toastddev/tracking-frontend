# Integrating into `pennywise-admin`

Goal: keep `tracking-frontend` as the source of truth for development, but
ship it as part of the existing **pennywise-admin** dashboard build so there
is **no separate hosting cost** and the existing GitHub Actions pipeline
deploys both at once.

This document covers two things:

1. **How to wire the two GitHub repos together** (git subtree, recommended).
2. **How the admin build picks up and serves the tracking sub-app**.

---

## Why git subtree (and not submodule or copy)?

| Approach     | Verdict                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Submodule    | ❌ Forces every cloner to know about it. CI sometimes forgets `--recurse-submodules`. Painful. |
| Manual copy  | ❌ Drift. No way to sync changes back to the source repo.                                      |
| **Subtree**  | ✅ Code lives in `apps/tracking/` of the admin repo. Cloners get it for free. Bidirectional sync. |
| Monorepo     | ✅ Even better long-term (npm workspaces, single `package.json` at root) but a bigger lift.     |

Use **subtree** today; consider promoting to a workspaces monorepo later.

---

## 1. One-time setup

> Both repos must already exist on GitHub. We assume `pennywise-admin` and
> `tracking-frontend` are siblings on disk and the admin uses Vite/Next/CRA
> (the steps work for any static-bundled React app).

### a. Push `tracking-frontend` to GitHub

```bash
cd tracking-frontend
git init
git add .
git commit -m "init: tracking dashboard"
git branch -M main
git remote add origin git@github.com:<your-org>/tracking-frontend.git
git push -u origin main
```

### b. Pull it into `pennywise-admin` as a subtree

```bash
cd ../pennywise-admin
git remote add tracking-frontend git@github.com:<your-org>/tracking-frontend.git
git fetch tracking-frontend

# Drop it under apps/tracking/ — pick any path you want
git subtree add --prefix=apps/tracking tracking-frontend main --squash

git push origin main   # ship the merged commit to the admin's main branch
```

`apps/tracking/` now contains the full `tracking-frontend` source. It looks
like normal files in the admin repo — anyone cloning the admin gets it
without needing to know it came from a subtree.

---

## 2. Pulling updates from `tracking-frontend` into `pennywise-admin`

Whenever you ship changes to `tracking-frontend`:

```bash
cd pennywise-admin
git fetch tracking-frontend
git subtree pull --prefix=apps/tracking tracking-frontend main --squash
git push origin main
```

CI then deploys the combined dashboard automatically.

## 3. Pushing changes back from `pennywise-admin` to `tracking-frontend`

If you fix something in `apps/tracking/` while working in the admin repo:

```bash
cd pennywise-admin
git subtree push --prefix=apps/tracking tracking-frontend main
```

That cherry-picks the relevant commits onto the `tracking-frontend/main`
branch. Continue developing in either repo as you prefer.

---

## 4. Building the tracking sub-app as part of the admin

The admin needs to build `apps/tracking/` and serve its output under a
sub-path (e.g. `/tracking`). The cleanest approach is two parallel builds in
CI, then merge their `dist/` outputs.

### a. Add an install + build step to your admin's CI workflow

Edit `.github/workflows/<your-deploy>.yml` in the admin repo (the one that
already deploys it). Add a step **before** your existing `npm run build`:

```yaml
- name: Install tracking-frontend deps
  working-directory: apps/tracking
  run: npm ci

- name: Build tracking-frontend
  working-directory: apps/tracking
  env:
    VITE_APP_BASE: /tracking
    VITE_API_BASE_URL: ${{ secrets.TRACKING_API_BASE_URL }}
  run: npm run build

- name: Stage tracking build into admin output
  run: |
    mkdir -p admin-dist/tracking
    cp -R apps/tracking/dist/* admin-dist/tracking/
```

> Replace `admin-dist` with whatever directory your admin build outputs to
> (e.g. `dist`, `out`, `build`). The point is: the tracking dashboard's
> `dist/` ends up under `<admin-output>/tracking/`.

### b. Configure the env vars in the admin repo's GitHub Settings

Add these as repository secrets / variables on the **admin** repo:

| Name                          | Example                                | Purpose                                                  |
| ----------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `TRACKING_API_BASE_URL`       | `https://tracker.example.com`          | Base URL of the tracking backend admin API.              |

`VITE_APP_BASE=/tracking` is set in the workflow itself (it's a build-time
constant, not a secret).

### c. Make sure the host serves SPA fallback for `/tracking/*`

Because the tracking app uses client-side routing, requests to deep links
like `/tracking/postbacks/kelkoo` must be served `/tracking/index.html`.

- **Cloud Run / Vercel / Netlify / S3+CloudFront**: add a rewrite rule
  `/tracking/*  →  /tracking/index.html` (only when the file isn't found).
- **nginx**:
  ```nginx
  location /tracking/ {
    try_files $uri $uri/ /tracking/index.html;
  }
  ```
- **Firebase Hosting** (`firebase.json`):
  ```json
  {
    "hosting": {
      "rewrites": [
        { "source": "/tracking/**", "destination": "/tracking/index.html" }
      ]
    }
  }
  ```

### d. (Optional) link from the admin's main nav

Add a sidebar entry in the admin repo that points at `/tracking`. The two
apps share the browser session but have **separate auth** (the tracking app
manages its own login under that path).

---

## 5. Local development

### Standalone (recommended for fast iteration)
```bash
cd tracking-frontend
npm run dev      # http://localhost:5173 — proxies /api → http://localhost:3000
```

### As part of the admin
```bash
cd pennywise-admin/apps/tracking
npm install
npm run dev
# served on its own port; the admin dev server stays on its own port
```

If you want the admin dev server to proxy `/tracking/*` to the tracking dev
server (so links work end-to-end), add a proxy entry in the admin's
`vite.config.ts` / dev server config:

```ts
server: {
  proxy: {
    '/tracking': { target: 'http://localhost:5173', ws: true, changeOrigin: true },
  },
},
```

In production this isn't needed — both apps are served from the same origin.

---

## 6. Auth: tracking has its own credentials

The tracking dashboard uses **its own** JWT-based auth, separate from the
admin dashboard's login. This is by design — the tracking backend is a
different service with different credentials. The tracking dashboard:

- Lands on `/tracking/login` if the user isn't authenticated.
- Stores its JWT in `localStorage` under `tracking_admin_token`.
- Calls `POST /api/auth/login` against the **tracking backend** (not the
  admin backend) to get the JWT.

Configure the admin user via env vars on the **tracking backend** (see
`tracking/.env.example`):

```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<long-random-string>
JWT_SECRET=<32+-char-random-string>
ADMIN_CORS_ORIGINS=https://your-admin.example.com
PUBLIC_TRACKING_BASE_URL=https://tracker.example.com
```

`ADMIN_CORS_ORIGINS` must include the **admin dashboard's origin** so the
browser can call the tracking API from `/tracking/*`. List multiple origins
comma-separated if you have staging + prod.

---

## 7. Sanity checklist

After the first deploy:

- [ ] `https://your-admin.example.com/tracking` loads the login screen.
- [ ] Logging in redirects to `/tracking/offers`.
- [ ] Hard-refreshing on `/tracking/postbacks/anything` still loads the app
      (SPA fallback rule is in place).
- [ ] `Network` tab shows requests to `${TRACKING_API_BASE_URL}/api/...`
      with `Authorization: Bearer …`.
- [ ] CORS preflight succeeds — admin origin is in `ADMIN_CORS_ORIGINS`.
- [ ] Creating an offer returns a tracking URL pointing at
      `PUBLIC_TRACKING_BASE_URL` (not `localhost`).

---

## 8. Promoting to a real monorepo (optional, later)

Once you have multiple sub-apps, switch the admin repo to npm workspaces:

```jsonc
// pennywise-admin/package.json
{
  "private": true,
  "workspaces": ["apps/*"]
}
```

`npm install` at the root will install dependencies for every app, dedup
shared packages, and let you reference shared internal packages by name.
The subtree relationship can stay — it just gives you a clean way to keep
the tracking app developable in isolation when you want to.
