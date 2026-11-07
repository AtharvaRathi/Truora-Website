# Truora Android and iOS app

The native app lives in `mobile/`. The existing Next.js website remains at the repository root and stays hosted on Vercel. Both use the existing Supabase project. The browser preview is a React Native web rendering for reviewing screens; it does not convert or replace the website.

## Included journeys

- Customer home, shared product/rental/service catalog, search and categories, product details, purchase/rental selection, rental duration, quantities.
- Surgery package customisation: recommendations, optional equipment and services, buy/rent, quantities, rental periods, reset, and package-linked cart lines.
- Shared accounts, signup, password login, confirmation/reset callback, logout, profile, deletion request and administrator review queue.
- Guest device cart with explicit import into an account cart; signed-in carts use optimistic versions shared by app and website.
- Demo checkout with server-authoritative prices, stable retry keys, delivery details, rental start and linked recovery plans.
- Order details, customer recovery timeline/history, care visits and service/callback requests.
- One app for all operational roles. Existing database membership controls customer/team switching; signup never grants a team role.
- Staff/manager/admin customer, order, request, recovery, scheduling, internal notes, team directory and audit journeys; privileges mirror the website. Providers can access only their assigned visits and progress them sequentially.
- Private Supabase realtime change signals, reconnect reconciliation, notification inbox, opt-in native push registration, server-only dispatch outbox/Edge Function source.
- Native screen navigation, safe areas, local fonts/assets, accessible buttons/labels and short screen transitions.

Demo orders, prices, scheduling and recovery coordination remain demonstrations. No real payment, reservation, delivery or clinical service is performed.

## Shared architecture

`packages/core/` owns catalog helpers, package stages, validation and operational types. `lib/catalog.ts`, `lib/packages.ts`, `lib/validation.ts` and `lib/workspace.ts` re-export those modules for existing website imports. Mobile dependencies remain in `mobile/package-lock.json`, separate from the Next.js lockfile to avoid conflicting React versions.

`GET /api/mobile/v1/catalog` is public. All other mobile endpoints require a Supabase access token in `Authorization: Bearer ...`. The server verifies it using Supabase Auth before querying under that same user's token. Browser cookies, supplied user IDs and supplied roles cannot authenticate mobile endpoints. Mobile sessions use device secure storage (chunked for large values). The web screen preview uses sessionStorage and must stay local.

The mobile API is stateless and permits cross-origin requests without credentials. It never accepts cookie authentication. Existing website endpoints retain their same-origin cookie/CSRF protection. `/api/realtime` provides a verified website session token only to same-origin JavaScript using a custom header; responses are uncached.

The shared published catalog merges public sample metadata with current database product prices/availability and recovery templates. Checkout always calculates its own prices. Old order snapshots are unchanged. Structural catalog changes should update both shared source and database migrations together; adding a new screen still requires implementing both applicable interfaces.

## Local development

From the repository root:

```sh
npm ci
npm run dev
```

In a second terminal:

```sh
cd mobile
npm ci
cp .env.example .env
# Fill only the public Supabase connection values.
npx expo start
```

The API URL must be reachable from the test device. `127.0.0.1` points to that device itself on a physical phone. Use the deployed HTTPS API for hosted testing. Local website SQLite accounts do not exist in Supabase and cannot log into the native app.

For browser screen review:

```sh
npm run export:all --prefix mobile
node scripts/preview-mobile.mjs
```

Open http://127.0.0.1:8081. Device-only push, signing and secure storage must be tested using native builds. Android SDK is not currently installed on this machine; no signed native binary is claimed by a JavaScript export.

## Supabase installation and realtime

For an existing project with migrations 001–004, apply 005, 006, 007 and 008 in order. These add the shared catalog, versioned carts, private signal policies, notification inbox/device registration/outbox and administrator deletion review. All new private tables have RLS and limited grants. No team memberships are activated by these migrations.

Triggers publish only `{refresh:true}` to private `user:<UUID>`, `operations`, and `catalog` channels. A signal never contains customer contact details or record contents. Re-fetching records checks the current permissions, including deactivated roles. Subscription permissions can remain cached for an existing connection, so keeping signal payloads empty of private data is intentional.

Add `truora://auth-callback` to Supabase Auth's allowed redirect URLs before testing confirmation/recovery emails on native builds. Production email confirmation and SMTP still need the earlier production setup; demo confirmation remains disabled as previously approved. Configure a trusted mail service before real use. Native password login does not require an email redirect.

## Expo account setup — next handoff

1. Sign into https://expo.dev in the built-in browser using the account that should own Truora. Connect GitHub and grant access to the Truora repository. Account owner should perform any new permission/credential confirmations.
2. Create/link the Expo project from the **mobile directory**, with app root/base directory `mobile` when asked. Do not connect the root Next.js project to Expo Hosting.
3. Configure the Expo project UUID in `EXPO_PUBLIC_EAS_PROJECT_ID`. The dynamic app config reads it for `extra.eas.projectId` and the update URL. Do not invent a project UUID.
4. In Expo development/preview/production environments set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_EAS_PROJECT_ID`. These are public application settings. No service-role key, database password, private signing credential or dispatch secret belongs in `EXPO_PUBLIC_*`.
5. Install/run EAS CLI and authenticate it under the same account. Browser sign-in alone does not automatically authenticate a terminal. Use the supported login flow; keep passwords/2FA private.
6. Run `eas project:info` from `mobile` and verify the project owner and identifier before creating builds. Choose final app identifiers before the first store registration; current proposed IDs are `com.truora.recovery`.
7. Configure Android signing and Apple signing in EAS. Apple membership and registered test devices are needed for iPhone internal/ad hoc distribution. iOS simulator builds can use the simulator profile without a store distribution certificate.
8. Build Android preview APK: `eas build --platform android --profile preview`. Build an iPhone preview using `--platform ios --profile preview`, or TestFlight with production/store signing. Install on real devices and test both customer and provider flows.

## Automatic releases

`.github/workflows/verify.yml` runs website/mobile type checks, database checks, website production build, native/web JavaScript exports and local HTTP regressions. The existing Vercel Git integration still deploys the website from `feature/commerce-accounts`.

The mobile release job is deliberately inactive until Expo/store credentials exist: enable the repository variable `MOBILE_RELEASES_ENABLED=true` only after setup. It runs after checks succeed, using GitHub's `mobile-production` environment and an `EXPO_TOKEN` secret. Add the public Expo project UUID as the matching repository variable. Do not commit tokens.

`mobile/.eas/workflows/release.yml` follows Expo's fingerprint-based release pattern: reuse a compatible native build and publish an OTA update, or build and submit a new native binary when the runtime changed. Configure the production update channel to the production branch. Store submissions must be configured first. Automatic upload is not automatic store approval or installation.

Do not enable production release automation against incomplete store listings or untested production credentials. Database changes must be applied and verified before deploying clients that require them. Earlier migrations were installed manually, so initialise/repair Supabase migration history to match the applied versions before enabling CLI-driven migration automation; never re-run 001–008 blindly. Keep schema changes backward compatible with installed versions and use staged feature flags for features needing new native capabilities.

For OTA rollback, republish a verified compatible update to its channel. For a database change, use a tested forward corrective migration; do not drop customer tables. A native store release requires a corrective store build or the store's release controls.

## Push notification activation

Device registration/inbox and the server dispatcher are implemented. Actual background delivery requires the remaining account setup:

1. Configure APNs and FCM credentials for the linked Expo project. Firebase is used only for Android messaging credentials, not another application backend.
2. Deploy `supabase/functions/push-dispatch` to the existing Supabase project. It uses server-only Supabase secrets and requires `x-dispatch-secret`; never put this secret in the website/app.
3. Create a strong `PUSH_DISPATCH_SECRET` privately and store it in the Edge Function secrets and Supabase Vault. Enable Expo push access-token security and set the corresponding server-only `EXPO_ACCESS_TOKEN` if using that feature.
4. Use Supabase Cron/pg_net to invoke the function periodically with the Vault-held secret, or call it from a trusted scheduled server worker. Do not expose an unauthenticated endpoint or put secrets in a public cron URL. Set a batch schedule appropriate to the free quota; no paid service has been purchased.
5. Opt in from a signed-in physical-device build, cause a synthetic assigned-visit/order change, and verify receipt on iOS and Android. Sign-out removes the device registration when online.

The queue retries transient failures (up to five claims), removes immediate DeviceNotRegistered tokens and sends only generic text. Accepted Expo tickets are not proof of delivery to a device. Production operations should add push-receipt reconciliation and monitoring for exhausted retries, plus a retention policy for old notifications/outbox records.

## Store release

Before public launch, complete real device testing, restore verified email ownership, finalise privacy/retention/support procedures, account-deletion fulfilment, production catalog/pricing and the real commerce/service operating model. The app's deletion request starts a manual administrator-reviewed process; it does not immediately erase records. Administrators see requests on their workspace overview.

Create Google Play and Apple Developer accounts under the correct legal owner. Prepare icons, screenshots, app description, support/privacy/deletion URLs, platform data disclosures and role-specific review accounts. Upload Android AAB to internal/closed testing and iOS to TestFlight first. Complete any applicable Google personal-account testing requirements, then submit for public review. Store fees, membership, identity verification and review are outside a free beta build.

## Verification

- `npm run typecheck`
- `npm run test:database` (includes mobile sync isolation/conflict tests)
- `npm run test:api` with the local website running
- `npm exec next build -- --webpack` (or the normal build on Vercel)
- `npm run typecheck --prefix mobile`
- `npm run export:all --prefix mobile`
- `npx expo-doctor` from `mobile`

These checks do not replace native compilation, physical-device testing, push delivery testing or store review. The operations lists retain the current bounded snapshot limits (latest 200, audit 100, visit window -7/+60 days); global pagination/history expansion remains a production scaling task.
