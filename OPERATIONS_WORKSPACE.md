# Truora Operations

Open `/workspace` (or `/admin`, which redirects there). Use the same Truora login as the customer website. No public signup grants team privileges. The portal uses Vercel and Supabase; no additional hosting service or secret service-role key is required.

## Access model

| Capability | Administrator | Manager | Operations staff | Care provider |
| --- | --- | --- | --- | --- |
| Customers, order details, requests, internal notes | Yes | Yes | Yes | No |
| Advance orders and service requests | Yes | Yes | Yes | No |
| Approve recovery stage changes | Yes | Yes | No | No |
| Schedule and cancel care visits | Yes | Yes | Yes | No |
| Accept, start and complete assigned visits | Yes | Yes | Yes | Own assigned visits |
| Team directory | Yes | Yes | Yes | Own membership only |
| Add/change/deactivate team access | Yes | No | No | No |
| Audit history | Yes | Yes | No | No |

Providers have specialties: physiotherapist, nurse, caregiver, dietitian, doctor or other (care coordination). Scheduling requires the provider specialty to match the selected service. Administrators should independently verify identity, qualifications and professional role before assigning access; entering a specialty is not credential verification.

## Database installation

For an existing Truora database with migrations 001 and 002, run `supabase/migrations/003_operations_workspace.sql` and then `supabase/migrations/004_visit_order_context.sql` once each in the Supabase SQL Editor. For a fresh database, run all migrations in numeric order. Migration 003 creates team membership, care tasks, internal notes, append-only audit storage, protected operations RPCs and the restricted customer visit view. It deliberately activates no team members.

The first administrator must be bootstrapped by an existing trusted Supabase project operator, after independently verifying the exact existing Truora account UUID. Use a transaction and record the bootstrap in the audit log. Do not promote an arbitrary account just because it claims a particular email: email confirmation is disabled for the currently approved demo. There is no public bootstrap endpoint, default admin password, frontend admin allowlist or role derived from user-editable signup metadata.

```sql
-- Replace both occurrences with the independently verified auth.users UUID.
begin;
insert into public.team_members(user_id,role,specialty,active)
values ('VERIFIED-ACCOUNT-UUID','admin','other',true);
insert into public.workspace_audit(actor_id,action,entity_type,entity_id,details)
values ('VERIFIED-ACCOUNT-UUID','admin_bootstrap','team','VERIFIED-ACCOUNT-UUID',
        '{"role":"admin","identity_verified":true}');
commit;
```

After bootstrap, add staff in **Team directory → Add team member** using their existing Truora login email. Select their operational role and provider specialty, verify the intended account, and activate access. No invitation email is sent. Team members create their accounts themselves and keep their passwords private. An administrator cannot change their own access, and the final administrator cannot be removed through the portal.

## Daily workflow

1. Review **Overview** for active recovery plans, open service requests and upcoming visits.
2. In **Customers**, open a customer record to see contact details, linked orders, recovery plans and requests. Add internal CRM notes for coordination and follow-up.
3. Review a **Recovery package** and advance it one stage at a time. The customer sees its updated timeline and timestamped history after refreshing their account. Operations staff cannot approve recovery stages.
4. Choose **Schedule a visit**, select the customer, optional linked package/order/request, service, matching provider, Mumbai/IST start time and duration. The database rejects overlapping active bookings for the same provider. Caregiver shifts default to 720 minutes. Cancel and recreate a visit if its time or provider changes.
5. The provider logs into `/workspace`, sees only their assigned visits, and progresses **Scheduled → Accepted → In progress → Completed**, with an optional operational completion handover. Providers cannot view the customer directory, unrelated orders, CRM notes or audit history, and cannot cancel assignments themselves.
6. Customers see assigned visits under **My account → Care visits**. That view contains the service, provider name, time, duration and status; it excludes internal instructions and completion handovers.
7. Admins/managers can review the **Activity log**. Status updates, visit assignments, team-role changes and note additions are audited. Note bodies and visit handovers are not copied into audit metadata. Records cannot be deleted through the dashboard.

Order workflow: **Demo submitted → Reviewed → Preparing → Dispatched → Completed**. Request workflow: **Demo submitted → Contacted → In progress → Resolved**. Either can be cancelled before a terminal status. Recovery workflow remains the six stages from migration 002. Conflicting updates from a stale screen are rejected; refresh before retrying. Completing a visit does not automatically complete a recovery package.

## Current iteration

This is a CRM and care-operations portal. Existing purchases, rentals and service requests remain demos: no payment, delivery, real appointment, automated email, SMS or WhatsApp message is triggered by portal controls. Professional payroll, clinical records, stock purchasing and website-content authoring are not part of this release.

Lists load the latest 200 records and filter that loaded list. Audit history shows the latest 100 changes. The schedule shows the past seven days through the next 60 days, up to 200 visits; customer accounts show their latest 100 visits. Global overview counts are database totals. Updates refresh on focus, manual refresh or mutation; no realtime subscription runs in the background. For larger operations, add server-side search, cursor pagination and a separate historical schedule view.

Email verification and custom SMTP still require production setup before real public use. Current staff grants are explicit, server checked memberships even while demo email confirmation is off. Real deployment credentials and customer data must never be seeded from local QA fixtures.

## Verification and local development

- `npm run test:database` tests PostgreSQL pricing, RLS, role isolation, scheduling conflicts, stale changes, transitions and customer visit privacy.
- `npm run test:api` tests local HTTP accounts, checkout and role-protected operations.
- Run a production build before deployment. All original public URLs are preserved; the public site uses the `(website)` route group and the operations portal has its own layout under the shared authentication provider.

The local workspace uses the existing ignored SQLite development database and also starts with no team permissions. Tests create synthetic memberships directly in that local database. `PERSIST_WORKSPACE_QA=1 node --test tests/workspace-api.test.mjs` retains synthetic local browser-review accounts in ignored `.local/workspace-qa.json`; never upload this file. Production builds explicitly exclude `.local` and tests.
