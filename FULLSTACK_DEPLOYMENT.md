# Truora account, commerce and service app — deployment guide

This iteration includes shared accounts, profiles, demo product/rental orders and service/callback requests. **It does not charge money or arrange actual delivery, equipment reservations, callbacks or clinical care.** Mumbai remains pre-launch.

## Recommended free preview stack

**Render Free Web Service + Supabase Free**. Next.js serves both the website and API; Supabase provides Postgres and authentication. No separate Express server, paid database or Redis is needed.

Render's free service sleeps after 15 minutes without traffic and takes time to wake. Supabase Free can pause inactive projects. These tiers are for evaluating this iteration, not dependable patient-facing operations.

The existing Vercel configuration also works with the same Supabase project. Vercel Hobby is restricted to personal, non-commercial use; do not assume a business storefront qualifies. Choose a suitable Vercel plan if continuing there for business use.

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

## 3. Deploy the Next.js app to Render Free

1. Sign in at https://dashboard.render.com.
2. Choose **New → Web Service**. Connect the GitHub repository `AtharvaRathi/Truora-Website` and branch `feature/commerce-accounts`.
3. Select the **Node** runtime and **Free** instance type. Do not create a Static Site; the account and order APIs need a running server.
4. Use these settings:

| Setting | Value |
| --- | --- |
| Root directory | Leave empty / repository root |
| Build command | `npm ci && npm run build` |
| Start command | `npm run start:hosted` |
| Instance type | Free |
| Node | 24.x, also pinned in `package.json` and `.nvmrc` |

5. Add these environment variables in Render:

```text
APP_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

6. Deploy. Render supplies `PORT`; the hosted start command listens on `0.0.0.0` and uses that port.
7. Copy the actual `https://…onrender.com` URL. Optionally set `NEXT_PUBLIC_SITE_URL` to that exact URL and redeploy. The app also recognises Render's automatic hostname for its SEO origin.

No disk is needed on Render: all hosted accounts and records live in Supabase. **Do not set `APP_BACKEND=local` online.** The application refuses the development SQLite adapter on Render and Vercel, preventing accidental use of an ephemeral local database.

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

4. Keep redirects limited to domains you control. Add your Vercel production URL too only if you use it.

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

## Optional: use Vercel instead of Render

1. Import the same repository in Vercel (or use the existing project). Deploy `feature/commerce-accounts` as a preview, or set it as the production branch of a separate demo project. Merge into `main` when you are ready to use it for that project’s production release.
2. Keep **Next.js**, root `./`, Node **24.x**, `npm ci`, `npm run build`, and the default output directory.
3. Add the three Supabase environment variables from step 3 to the appropriate deployment environment. Do not configure a local SQLite backend.
4. Deploy or redeploy.
5. Add the actual Vercel origin and callback URLs in Supabase as described above.
6. Optionally set `NEXT_PUBLIC_SITE_URL` to the canonical domain and redeploy. Preview deployments should use a separate test Supabase project if you want their data isolated from production.

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
- Render free service limitations: https://render.com/docs/free
- Render Next.js web service: https://render.com/docs/deploy-nextjs-app
- Vercel Hobby restrictions: https://vercel.com/docs/plans/hobby
