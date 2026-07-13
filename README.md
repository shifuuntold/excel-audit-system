# Excel Chemicals — Field Sales Audit System

A mobile-first web app that replaces Excel Chemicals' paper-based outlet
audit process. Field sales reps ("Auditors") record outlet visits, product
availability, competitor activity, and retailer feedback; Supervisors and
Admins get team-wide analytics and generate written field audit reports.

Live app: https://excel-audit-system.vercel.app

## What it does

- **Audit capture** — a 4-step wizard (Outlet → Products → Market →
  Review) records outlet details, GPS location, which of Excel's ~90
  product/flavour/size combinations are stocked, distributor and
  competitor activity (by product category), and retailer feedback.
- **Offline support** — if a rep loses signal mid-visit, the audit saves
  to the device and syncs automatically once back online.
- **History & search** — filter past audits by date, area, or outlet
  name; search "how many outlets stock DTD?" style questions across a
  filtered set.
- **Reports** — generates a narrative field audit report (Executive
  Summary, Product Penetration, Competitive Landscape by category,
  Distributor Activity, themed Retailer Feedback, Recommendations) and
  exports it as a Word document.
- **Exports** — Excel and PDF exports of filtered audit lists, including
  a clickable Google Maps link per outlet.
- **Roles** — Auditor (own audits only), Supervisor (all audits +
  analytics), Admin (also manages users, areas, distributors, competitors).

## Stack

- **Frontend**: React 19 + Vite, Tailwind CSS v4
- **Backend**: Supabase (Postgres, Auth, Row-Level Security) — no
  separate backend server
- **Exports**: jsPDF, SheetJS (xlsx), docx — all lazy-loaded so the core
  app stays light on mobile data
- **Testing**: Vitest

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public API key |

### Database setup

Run the SQL files in `supabase/` (in the Supabase SQL editor) in order —
each one is idempotent and safe to re-run. They set up the `areas`,
`distributors`, `competitors` tables, the `auditor` / `supervisor` /
`admin` role structure, and the Row-Level Security policies that enforce
it server-side (not just in the UI).

### Available scripts

```bash
npm run dev       # local dev server
npm run build     # production build
npm run preview   # preview a production build locally
npm run lint      # ESLint
npm test          # run the test suite (Vitest)
```

## Project structure

```
src/
  components/
    audit/       # the 4-step audit wizard + product/competitor/distributor pickers
    common/      # shared UI: Button, Input, Select, Toggle, LoadingSpinner...
    dashboard/   # stat cards, trend chart
    layout/      # Header, PageContainer, BottomNavigation
  config/
    theme.js           # brand colors
    productCatalog.js  # product/flavour/size matrix, competitor categories
  contexts/      # Auth + in-progress-audit React context
  hooks/         # useOnlineStatus, useOfflineQueue
  pages/         # one file per route
  services/      # all Supabase reads/writes, report generation, exports
  utils/         # pure helper functions (product summaries, competitor/
                 # distributor flattening, report analytics) — see __tests__
```

## Why Supabase, not a custom backend

The project originally targeted a Django-style backend, but moved to
Supabase early on: it gives Postgres, authentication, and row-level
security out of the box, and a hosted Vercel + Supabase deployment needs
no server to maintain. Row-Level Security policies (in `supabase/`) are
the actual enforcement layer for the role system — the UI hides things
a role shouldn't see, but the database is what actually blocks it.

## Known limitations

- User creation is self-service sign-up (an Admin then promotes roles
  from the Admin panel) rather than Admin-initiated invites — a true
  invite flow would need a Supabase Edge Function holding the service-role
  key, which is a deliberate scope cut to avoid ever shipping that key
  to the browser.
- Reports currently fetch and aggregate client-side, which is fine at
  current audit volumes but would need a server-side aggregation (e.g. a
  Postgres view or RPC function) if audit volume grows into the thousands.
