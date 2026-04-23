# Tracking Admin · Frontend

React + Vite + Tailwind dashboard for the [tracking backend](../tracking).
Built so it can run **standalone in dev** and be **embedded as a sub-app
inside the existing `pennywise-admin` dashboard at build time** — no extra
hosting cost, one CI/CD pipeline.

---

## 1. Stack

| Concern        | Choice                            |
| -------------- | --------------------------------- |
| Framework      | React 18 + TypeScript             |
| Bundler        | Vite 6                            |
| Routing        | React Router 6                    |
| Server state   | TanStack Query 5                  |
| Styling        | Tailwind CSS 3 (custom palette)   |
| Icons          | lucide-react                      |
| Dates          | date-fns                          |

The bundle is intentionally light (~85 KB gzipped JS) and uses only
hand-rolled UI primitives so it merges cleanly with another design system.

---

## 2. Local development

### Prerequisites
- Node.js >= 20
- The tracking backend running on http://localhost:3000 (see `../tracking/INSTALL.md`)
- An admin user configured in the backend's `.env`:
  ```
  ADMIN_EMAIL=admin@example.com
  ADMIN_PASSWORD=change-me
  JWT_SECRET=<long-random-string>
  ADMIN_CORS_ORIGINS=http://localhost:5173
  PUBLIC_TRACKING_BASE_URL=http://localhost:3000
  ```

### Run
```bash
cp .env.example .env       # optional — defaults work for localhost
npm install
npm run dev                # http://localhost:5173
```

In dev, Vite proxies `/api/*` to the backend on `localhost:3000`, so no CORS
config is needed locally. Override the proxy target with `VITE_API_PROXY` in
`.env` if your backend runs elsewhere.

### Scripts
- `npm run dev`        — hot-reloading dev server on `:5173`
- `npm run build`      — produces `dist/` (static assets)
- `npm run preview`    — serves the build locally
- `npm run typecheck`  — `tsc --noEmit`

---

## 3. Pages

| Route                    | What it does                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `/login`                 | Email + password against `POST /api/auth/login`. Stores JWT in localStorage.                  |
| `/offers`                | Paginated, prefix-searchable list of offers/stores. Create from a modal; copy tracking URL.   |
| `/offers/:id`            | Offer detail. Shows tracking URL, affiliate template, default params. Edit in modal.          |
| `/postbacks`             | Paginated, searchable list of postback configurations (one per network).                      |
| `/postbacks/:id`         | Network detail: postback URL, mapping fields, **event log of every conversion received**.     |
| Conversion drawer        | Click any event in the log → side drawer with full postback payload, originating click info  |
|                          | (offer, affiliate, gclid/gbraid/fbclid/wbraid/ttclid/msclkid, etc.) when verified, or         |
|                          | "Click ID did not match" notice when unverified.                                              |

The **event log** filters by verified status and date range, paginates with
cursor-based pagination (latest first), and is backed by the existing
`(network_id, verified, created_at DESC)` Firestore composite index.

---

## 4. Integration into `pennywise-admin`

You want **one repo, one CI/CD, one deploy**. The recommended pattern is
**git subtree**: develop the tracking dashboard in *this* repo, then mirror
it into the admin repo at a sub-path. The admin's existing build picks it up.
Independent commits in either repo can be pulled in either direction.

The detailed walkthrough lives in [`INTEGRATION.md`](./INTEGRATION.md).
TL;DR:

```bash
# In pennywise-admin, one-time pull:
git subtree add --prefix=apps/tracking ../tracking-frontend main --squash

# Periodic refresh:
git subtree pull --prefix=apps/tracking ../tracking-frontend main --squash
```

The sub-app is mounted at `/tracking` of the admin URL. Set
`VITE_APP_BASE=/tracking` when building, and the React Router `basename`,
asset URLs, and `vite.config.ts` `base` all align automatically.

---

## 5. Project layout

```
tracking-frontend/
├── package.json
├── vite.config.ts            mountable base path + dev proxy
├── tsconfig*.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── README.md                 (this file)
├── INTEGRATION.md            git subtree + admin build steps
└── src/
    ├── main.tsx              entry
    ├── App.tsx               routes
    ├── index.css             tailwind + design tokens
    ├── lib/
    │   ├── api.ts            fetch wrapper, JWT auth, ApiError
    │   ├── auth.ts           token storage + subscription
    │   ├── queryClient.ts
    │   ├── format.ts         date/money/id helpers
    │   └── cn.ts             classnames
    ├── components/
    │   ├── Layout.tsx
    │   ├── Sidebar.tsx
    │   ├── ProtectedRoute.tsx
    │   ├── PageHeader.tsx
    │   └── ui/               Button, Input, Card, Table, Modal, Badge,
    │                         Pagination, Spinner, EmptyState, Select, CopyButton
    ├── features/
    │   ├── auth/             LoginPage
    │   ├── offers/           list + detail + form modal + api
    │   ├── postbacks/        list + detail + form modal + EventLog + api
    │   └── conversions/      ConversionDetailDrawer
    └── types/
        └── index.ts
```
