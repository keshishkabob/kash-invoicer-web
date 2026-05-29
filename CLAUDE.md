# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

No test suite is configured.

## Stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS v4** — config lives entirely in `app/globals.css` (no `tailwind.config.*`)
- **shadcn/ui** (style: `base-nova`) — component source in `components/ui/`, add new ones via `npx shadcn add <component>`
- **Supabase** — all DB access goes through `lib/supabase.ts` (anon client) and the typed helpers in `lib/db.ts`
- **@react-pdf/renderer** — used in the API route for server-side PDF generation
- Deployed on Railway (`railway.json`)

## Architecture

All pages are under `app/` using the Next.js App Router. Every page file is a `"use client"` component — there are no React Server Components in use beyond the root layout.

### Data layer (`lib/db.ts`)

Single file exporting typed async functions for every DB operation. All functions call Supabase directly — no API routes sit between the client pages and Supabase except for PDF generation. Supabase credentials are `NEXT_PUBLIC_*` env vars (client-side).

Key Supabase objects:
- Tables: `clients`, `time_entries`, `invoices`, `invoice_line_items`, `payments`
- View: `invoice_summary` — pre-computes `subtotal`, `tax_amount`, `total`, `total_paid`, `balance_due` per invoice

### Invoice PDF (`app/api/invoice-pdf/route.tsx`)

The only API route. Accepts `?id=<invoice_id>`, fetches invoice + line items from Supabase on the server, renders a PDF with `@react-pdf/renderer`, and streams it back as `application/pdf`. The file extension is `.tsx` (not `.ts`) because it contains JSX for the PDF document tree.

### Pages

| Route | Purpose |
|---|---|
| `/time-log` | Log billable hours; entries track client, project, hours, rate, and link to an invoice once billed |
| `/invoices` | Create invoices from unbilled time entries + manual line items; change status; download PDF |
| `/payments` | Record payments against invoices; auto-marks invoice `paid` when balance reaches zero |
| `/clients` | CRUD for client records; default rate pre-fills time entry forms |

### Invoice lifecycle

`draft` → `sent` → `paid` (auto when balance_due ≤ 0 after a payment is recorded)  
Any status → `void` (unlinks all associated time entries so they become billable again)

### UI conventions

- Toast notifications via `sonner` (`toast.success` / `toast.error`)
- Path alias `@/` maps to the repo root
- `cn()` utility in `lib/utils.ts` for conditional class merging
