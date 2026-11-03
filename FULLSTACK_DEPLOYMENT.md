# Truora account, commerce and service app — deployment guide

This iteration includes shared accounts, profiles, demo product/rental orders and service/callback requests. **It does not charge money or arrange actual delivery, equipment reservations, callbacks or clinical care.** Mumbai remains pre-launch.

## Selected architecture: Vercel + Supabase

Use **Vercel for the complete Next.js application** (website, rendering, API routes and authentication callbacks), and **Supabase for Auth and managed Postgres** (profiles, products, orders and service requests). Future uploads can use Supabase Storage. Render is not required. There is no static-export migration and no separate backend server to deploy.

For testing, Supabase Free is available within its quotas. Use Vercel's free Hobby tier only where the test project satisfies its personal, non-commercial terms; a business-labelled preview is not automatically eligible just because it does not collect payment. Choose an appropriate Vercel plan for commercial use. Supabase Free can pause inactive projects. Review both providers' quotas before launch.

The application already fits this architecture. Its protected Next.js API routes validate sessions and inputs, while Supabase RLS and database functions protect records and calculate authoritative totals. Keep both compute and database regions close to users where supported. This architecture supports the current requested features without changing the customer experience.

## 1. Make the code available to the host

This iteration is prepared on branch `feature/commerce-accounts` in `AtharvaRathi/Truora-Website`. Select that branch for a preview deployment. The host deploys GitHub source, not uncommitted localhost changes.

The repository root contains `package.json`. Use that root, not the earlier `truora` preview folder.

## 2. Create Supabase Free

1. Sign in at https://supabase.com/dashboard and create a project on the **Free** plan.
2. Choose an available region close to your users. Store the database password privately.
3. Wait until the project is ready.
4. Open **SQL Editor → New query**. Paste the full contents of `supabase/migrations/001_initial.sql` and run it **once** on this new project.
5. In Table Editor, verify `profiles`, `products`, `orders` and `service_requests` exist. There should be two demo products.
6. In the project's **Connect** dialog or API settings, copy the **Project URL** and **Publishable key**. The legacy anon key can be used in the publishable-key variable if the project still uses legacy keys.

Do not put a Supabase secret key, service-role key or database password into a `NEXT_PUBLIC_` variable. This app only needs the public project URL and publishable key. Database permissions and RLS enforce per-user access; order writes go through authenticated database functions.

## 3. Deploy the Next.js application to Vercel

1. Sign in at https://vercel.com/new and import `AtharvaRathi/Truora-Website`, or open the existing Vercel project.
2. This iteration is on `feature/commerce-accounts`. Deploy that branch as a Preview on an existing project, or select it as the Production Branch of a separate test project under **Settings → Git**. If the import initially deploys `main`, change the branch and redeploy before testing account features. Once reviewed, merge the feature branch into `main` for the normal production release.
3. Use these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | Repository root (`./`) |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave the Next.js default |
| Node.js | 24.x, pinned in `package.json` and `.nvmrc` |

4. Add these environment variables in **Settings → Environment Variables**:

```text
APP_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

5. Select **Preview** when testing the feature branch and **Production** for the eventual production deployment. Separate Supabase projects can isolate test data from real data when needed.
6. Deploy or redeploy after changing environment variables. Copy the actual URL Vercel assigns.
7. Optionally set `NEXT_PUBLIC_SITE_URL` to the preferred public origin and redeploy. The app otherwise uses Vercel's production hostname for canonical URLs.
8. Choose a Vercel function region near the Supabase project and your users, subject to your plan's available region settings.

No database disk or filesystem persistence is needed on Vercel: hosted accounts and records live in Supabase. **Do not set `APP_BACKEND=local` online.** Production refuses the development SQLite adapter. Do not configure an `out` or `dist` output folder; this deployment keeps the full Next.js runtime.

## 4. Configure authentication URLs

In Supabase **Authentication → URL Configuration**:

1. Set **Site URL** to the actual deployed origin, without a trailing path.
2. Add the exact deployed callback URL to **Redirect URLs**:

```text
https://YOUR-ACTUAL-HOST/auth/confirm
https://YOUR-ACTUAL-HOST/auth/confirm?next=/reset-password
```

3. For local development against the same Supabase project, optionally also allow:

```text
http://127.0.0.1:5173/auth/confirm
http://127.0.0.1:5173/auth/confirm?next=/reset-password
```

4. Keep redirects limited to domains you control. Add the exact Vercel Preview URL when testing a preview deployment, and the production/custom domain when launching.

## 5. Choose email behaviour for the demo

In **Authentication → Sign In / Providers → Email**, enable email/password sign-in. The application requires passwords of at least 10 characters.

**Closed demo without an email provider:** you can disable **Confirm email** for this test project, so signup immediately signs users in. This does not verify ownership of email addresses. Use synthetic test accounts, not real patient/customer accounts. Hosted password reset still requires functioning email delivery.

**Confirmation and password recovery for other testers:** configure a custom SMTP provider under Supabase Authentication's email/SMTP settings. Supabase's built-in sender only delivers to project-team addresses and is currently heavily rate-limited. Free-tier SMTP providers are listed in the official guide; their sender/domain verification requirements and quotas apply. No email provider has been purchased or configured by this code.

For server-side confirmation links that also work when opened in another browser, set the templates as follows. Keep the rest of the template's wording as desired.

**Confirm signup link:**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

**Password recovery link:**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset your password</a>
```

The route also supports the default PKCE `code` callback flow. SMTP credentials belong in Supabase's SMTP configuration, not in this repository or client-side environment variables.

## 6. Verify the hosted iteration

1. Create a synthetic account. If confirmation is on, confirm the email before signing in.
2. Update the profile and reload it.
3. Add a BP Machine purchase and a Wheelchair rental to the cart. Choose 7 or 30 days.
4. Continue to checkout, enter test delivery details and a future rental date, acknowledge the demo, and submit.
5. Verify the order appears under **My account → Orders**, with the rental deposit shown separately and payment status **Not charged**.
6. Use **Request a callback**, or request a service/package. Verify it appears under **My account → Service requests**.
7. Sign out. Create a second test account and verify that it cannot see the first account's orders or requests.
8. Test forgot-password using an email address that your SMTP configuration can deliver to. Verify the link is usable once and the new password works.
9. In Supabase Table Editor, verify records were stored. The project owner can inspect them there; no public admin dashboard is included.

Test local development and hosted Supabase separately. Local SQLite accounts and records do not migrate automatically to Supabase, and the browser's local cart is not a cross-device database cart.

## Scaling and operating costs

Vercel serves and runs the application; Supabase manages persistent data and authentication. They are two complementary services, not three backend subscriptions. Vercel handles application compute scaling, while database capacity still needs monitoring and appropriate upgrades.

Keep public content cacheable, paginate account records as they grow, retain indexed owner-based queries, and avoid unnecessary database calls. Review function execution, bandwidth, database compute/storage and authentication usage separately. Email delivery, domain registration and payment processing can have separate costs even with this two-platform architecture.

Long-running background jobs may eventually require a job service or a different execution pattern. The current account, checkout and request flows do not require a separate Render service.

## What is already protected

- The backend validates every write and requires a signed-in user for orders, profile changes and requests.
- Hosted Supabase sessions are checked with `auth.getUser()` inside API handlers, and session refresh cookies are written there. Private data is fetched through uncached APIs, not statically rendered into public pages. No browser-only login check is used to authorise data access.
- Same-origin JSON writes protect cookie-based mutations against cross-site submissions.
- Catalog prices and deposits are calculated on the server/database, not accepted from cart totals.
- Row-level policies restrict profiles, orders and requests to their owner. Clients cannot edit prices or order totals.
- Per-user database limits and idempotency keys protect order/request submission against basic abuse and duplicate retries.
- Local passwords are scrypt-hashed; local session tokens are random, hashed at rest and held in HTTP-only cookies. The local reset link is a development convenience and is never returned by the hosted Supabase adapter.
- `.local/`, environment files and generated output are ignored by Git; local databases and test files are excluded from server output tracing.

## Before accepting real orders

This is a demo commerce/service iteration. Real launch still needs verified catalog specifications and availability, commercial pricing/tax/delivery terms, real operations and order management, rental-return/deposit policies, an actual payment gateway with verified webhooks if online charging is required, appropriate email delivery, and a review of privacy/retention practices. Do not collect clinical records through the general request note.

## Reference links (checked 3 November 2026)

- Supabase free tier: https://supabase.com/pricing
- Supabase server-side auth: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase email restrictions/custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Next.js on Vercel: https://vercel.com/docs/frameworks/full-stack/nextjs
- Vercel Hobby restrictions: https://vercel.com/docs/plans/hobby
