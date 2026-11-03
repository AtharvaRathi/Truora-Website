> **The app now includes accounts, orders and service requests. Follow [FULLSTACK_DEPLOYMENT.md](./FULLSTACK_DEPLOYMENT.md) first for the required Supabase setup.** The basic Vercel import instructions below still apply, but hosted accounts now require the Supabase environment variables.

# Deploy Truora on Vercel

Repository: https://github.com/AtharvaRathi/Truora-Website

## 1. Import the repository

1. Sign in at https://vercel.com using the GitHub account that owns this repository.
2. Open **Add New → Project**, or visit https://vercel.com/new.
3. Find `AtharvaRathi/Truora-Website` and click **Import**.
4. If the repository is missing, use **Adjust GitHub App Permissions** / **Configure GitHub App** to grant Vercel access to this repository, then return to the import page.

## 2. Check the project settings

| Setting | Value |
| --- | --- |
| Project name | `truora-website` or another available name |
| Framework preset | **Next.js** |
| Root directory | Repository root (`./`); do not enter `truora` |
| Release branch | `feature/commerce-accounts` for the current account/commerce iteration; `main` after merge |
| Node.js version | **24.x**, pinned by `package.json` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave the Next.js default; do not enter `dist`, `out` or `public` |
| Environment variables | `APP_BACKEND`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see full-stack guide) |

The repository's `vercel.json` already declares the framework and install/build commands. The shared-account release requires the Supabase database migration and auth settings from `FULLSTACK_DEPLOYMENT.md`. No Cloudflare binding is required.

## 3. Deploy

1. Click **Deploy**.
2. Wait for the build to reach **Ready**.
3. Open the production URL shown by Vercel. Use the actual URL Vercel assigns; it can differ from the project name if that name is unavailable.
4. Visit Home, Packages, a surgery detail page, How It Works, Our Story and Contact. Refresh a nested page to verify direct navigation.
5. Check the mobile menu and FAQ controls, then verify the phone, email and WhatsApp destinations.

The site continues to display Mumbai as **Coming soon** and prices as indicative. Demo orders, callbacks and service requests are enabled once Supabase is configured. Deployment does not charge payments or arrange real fulfilment.

## 4. Public URL and SEO

The app chooses its public origin in this order:

1. `NEXT_PUBLIC_SITE_URL` if you explicitly configure it.
2. Vercel's `VERCEL_PROJECT_PRODUCTION_URL` system variable.
3. `VERCEL_URL` as a fallback on Vercel.
4. `http://localhost:5173` for local development.

This origin is used by canonical URLs, social previews, the sitemap, robots file and website structured data. Preview deployments include noindex metadata and disallow crawling; production deployments permit indexing.

Vercel normally exposes its system environment variables automatically. If you disabled that setting, enable it before deploying or set `NEXT_PUBLIC_SITE_URL` to the actual public production URL and redeploy. Do not set it to a guessed domain.

## 5. Add a custom domain later

1. Open the project in Vercel and go to **Settings → Domains**.
2. Add the domain you own.
3. Add the DNS records Vercel shows at your domain registrar and wait until Vercel marks the domain valid.
4. In **Settings → Environment Variables**, set `NEXT_PUBLIC_SITE_URL` to the preferred canonical origin, for example `https://your-real-domain.com`. Use the same canonical origin for Production and Preview if setting both.
5. Redeploy the production branch so static metadata, sitemap and robots use that domain.

Domain registration and DNS access are managed through your existing provider. No domain has been purchased or connected by this repository.

## 6. Future changes

Once Git integration is connected, a push to `main` triggers a production deployment. Use another branch and a pull request for changes you want to review as a Vercel Preview first. Merge when the preview is ready.

## If a build fails

- Confirm the selected root directory contains `package.json`.
- Confirm the preset is **Next.js** and Node.js is **24.x**.
- Remove old output-directory overrides.
- Open **Deployments → failed deployment → Build Logs** and inspect the first error.
- The exact commands to reproduce a build locally are `npm ci` and `npm run build`.

## Official references

- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/git/vercel-for-github
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/environment-variables/system-environment-variables
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
