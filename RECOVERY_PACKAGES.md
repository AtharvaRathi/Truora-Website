# Connected recovery packages

Phase 1 adds 10 surgery templates and 88 shared catalog entries (82 equipment/supply entries and six services). Products, Rentals, Services and the package customizer use the same IDs and rates. Some equipment is rental-only. Items with “quote required”, “not recommended” or similar rental cells are not offered for standalone rental unless the package sheet provides an explicit rental rate.

## Spreadsheet interpretation

The supplied `Phase 1 Post Op Package Cost.csv` contains both an introductory service-rate block and a detailed package matrix. The detailed matrix is authoritative for package contents and rates, including ₹600 physiotherapy sessions and ₹550 nursing visits. All 10 suggested totals reconcile exactly with its Standard price row. No package discount is assumed. Quantities for rentals mean days or weeks of hire, not multiple pieces of equipment. Service quantities mean visits, sessions, plans or shifts.

`Phase 1 Post Op Selling Price.csv` contains inventory costs and broad selling/rental ranges rather than a finalized price list. For additional catalog items, the lower selling/rental bound becomes a clearly labelled sample price. Catalog brands and links are not treated as verified specifications, endorsements or supplier contracts. Package matrix rates override overlapping catalog ranges. For weekly rental items, 30-day rates are five weekly units; daily items charge per day. Additional monthly rental ranges are represented as a 30-day sample rate, with a rounded-up one-quarter rate for seven days. No deposit was provided, so the new sample catalog assumes zero; earlier order receipts retain their original deposit snapshots. Inventory quantities are not interpreted as live stock.

`scripts/import-phase-one.py <package-csv> <catalog-csv>` imports only public fields into `lib/data/phase-one.json`. Do not commit raw cost spreadsheets. Costs, margins, supplier links, cost totals and inventory counts are not imported into public client assets or public database tables. If catalog data changes, update the seed in a new SQL migration alongside the JSON; frontend rates and backend authoritative rates must ship together.

## Customer flow

Choose surgery → customize suggested products, rental durations and care quantities → add package to cart → sign in → demo checkout → linked receipt and recovery journey. Draft selections persist in the browser. Re-adding the same surgery replaces that package’s cart selections, keeping standalone items and other packages separate. Checkout freezes the selected item names, rates, quantities, durations and package association. Subsequent catalog changes do not reprice saved receipts.

## Deployment

For an existing installation, apply `supabase/migrations/002_recovery_packages.sql` once in the Supabase SQL Editor before releasing this application version. For a new installation, apply `001_initial.sql` and then `002_recovery_packages.sql`. Do not re-run 001 on the existing project. No additional secrets or backend service are needed. Run `npm run test:database`, `npm run test:api` against local development, and a production build. Tests verify all package totals, customized selections, trusted prices, atomicity, idempotency, RLS and controlled status transitions.

## Care-team status operations

Customer accounts can only read their recovery journeys; they cannot set their own fulfillment status. For this iteration, authorized operators use Supabase's SQL Editor or Table Editor to advance `public.recovery_plans.status`. A staff dashboard is not included. Verify the selected plan belongs to the intended customer and update only after the corresponding work actually occurs:

`submitted` → `reviewed` → `scheduled` → `recovering` → `collection` → `completed`

`cancelled` can be reached from any nonterminal stage. The database rejects skipped/reversed stages and records timestamped history automatically. For packages without rentals, the collection stage represents checking that no returns or care visits remain. Existing statuses appear when the account is reopened, reloaded or refocused; this version does not subscribe to realtime database updates.

Example for a verified plan reference (replace the UUID yourself):

```sql
update public.recovery_plans
set status = 'reviewed'
where id = 'REPLACE-WITH-VERIFIED-PLAN-UUID'
  and status = 'submitted';
```

All checkout flows remain demos. No payment, real reservation, appointment, recovery outcome or delivery is promised by submission. Email confirmation remains disabled for the approved demo; SMTP and production email verification still need final configuration.
