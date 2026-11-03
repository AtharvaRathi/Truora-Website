# Truora app

Next.js 16, React, TypeScript and Tailwind CSS. One account for product purchases, equipment rentals and recovery service requests. The catalog and all transactions are demonstrations; no payment or real fulfilment occurs. Mumbai remains pre-launch.

## Run locally

Use Node.js 24.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. No credentials are needed locally. Create an account on the signup page. The development adapter stores hashed passwords and records in `.local/truora.sqlite`, ignored by Git. No email is sent locally; password recovery exposes a clearly labelled one-use development reset link. Use test details.

## Hosted backend

Use Supabase Auth and Postgres. Follow [FULLSTACK_DEPLOYMENT.md](./FULLSTACK_DEPLOYMENT.md) for the SQL migration, environment variables, authentication/email setup, free Render preview deployment and Vercel alternative. Hosted instances never fall back to SQLite. Real hosted Supabase auth/email must be verified after you configure your own project.

## Checks

```sh
npm run build
npm run typecheck
npm run test:database
# While the local development server is running:
npm run test:api
```

The database test runs the actual migration against embedded Postgres with simulated Supabase roles/identity. It verifies pricing, transaction rollback, idempotency, RLS and denied writes. The API test exercises local signup, sessions, profile changes, orders, requests, cross-origin rejection, password reset and cross-account access using synthetic accounts that it removes afterwards. It refuses to run against the hosted Supabase backend.

`npm start` serves a built site at localhost:5173; `npm run start:hosted` listens on 0.0.0.0 and the hosting platform's PORT. Production/hosted accounts require Supabase configuration.

## Key files

| File | Purpose |
| --- | --- |
| `lib/catalog.ts` | Two demo product specifications, images and display prices (integer paise) |
| `supabase/migrations/001_initial.sql` | Hosted schema, seed prices, RLS and authoritative order/request functions |
| `lib/backend.ts`, `lib/local-db.ts` | Supabase and local development adapters |
| `app/api/[...path]/route.ts` | Validated account, authentication, order and request API |
| `app/auth/confirm/route.ts` | Email confirmation and recovery callback |
| `components/app-provider.tsx` | Shared session state and browser-persisted cart |
| `components/catalog.tsx`, `components/checkout.tsx` | Product/rental selection, cart and checkout |
| `components/auth-screen.tsx`, `components/account.tsx` | Shared login/signup/recovery/profile/order area |
| `components/request-form.tsx` | Authenticated callback, service and package requests |
| `lib/content.ts` | Contact details, recovery categories and informational copy |
| `app/globals.css` | Existing design system plus shop and account layouts |
| `lib/site-config.ts` | Canonical site URL for Vercel, Render or a custom domain |

Changing live demo prices requires updating both `lib/catalog.ts` (display) and Supabase's `products` rows (authoritative checkout). Do not accept prices or user IDs from browser totals. Cart contents persist on this browser only; account records persist in the configured database.

## Current scope

- BP Machine and Wheelchair, both purchase and 7/30-day rental options, sample pricing and deposits.
- Signup, login/logout, email confirmation and password recovery integration, editable shared profile.
- Cart quantity/removal, protected checkout, persisted order details/history.
- Callback, service and recovery package requests saved in the same account.
- No real payment gateway, stock reservation, dispatch, clinical scheduling, automated callback delivery or public admin dashboard. Project owners inspect demo records in Supabase Table Editor.

Assets, original generation prompts and font licenses are documented in [ASSETS.md](./ASSETS.md).
