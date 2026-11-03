# Truora Website

The initial informational website for Truora’s planned surgery recovery services in Mumbai. Built with native Next.js App Router, React, TypeScript and Tailwind CSS, ready for Vercel.

## Local development

Use Node.js 24 (also specified in `.nvmrc` and `package.json`).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. No sign-in, backend credentials or environment variables are needed for the introductory website.

## Verify the production build

```sh
npm run build
npm run typecheck
npm start
```

`npm start` serves the production build at http://127.0.0.1:5173. Stop the development server before starting it on the same port.

## Deploy on Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the dashboard steps, exact settings and custom-domain instructions. `vercel.json` configures the Next.js preset, `npm ci` and `npm run build`. Vercel manages the output directory.

## Content and components

| Location | Purpose |
| --- | --- |
| `lib/content.ts` | Phone, email, WhatsApp, six surgery categories, temporary prices, FAQs and recovery steps |
| `lib/site-config.ts` | Public site origin and preview-deployment indexing behaviour |
| `app/page.tsx` | Homepage |
| `app/packages/` | Package index and six surgery detail pages |
| `app/about`, `app/how-it-works`, `app/contact`, `app/privacy` | Informational pages |
| `components/site.tsx` | Navigation, footer, cards, FAQ interactions and reveal animations |
| `app/globals.css` | Typography, colours, layouts, responsive styles and motion |
| `public/` | Logo, original illustrative hero, icons and locally hosted fonts |

## Current release status

- Mumbai is planned, not live.
- Prices are indicative planning figures and may change.
- Phone/WhatsApp: +91 7798200771.
- Email: pranjalrathi1907@gmail.com.
- Enquiry forms, booking, payments, accounts and medical-document uploads are not enabled.
- No analytics or advertising trackers have been added.

Before services launch, confirm coverage, package inclusions, prices, deposits, rental terms and policies. Update the privacy page to reflect actual operations as features are introduced.

## Assets

The supplied logo is preserved in `public/images/truora-logo.png`. The hero image is illustrative AI-generated imagery, not an existing patient or member of staff. Original prompt, asset provenance and font licenses are documented in [ASSETS.md](./ASSETS.md).

## Runtime

This checkout runs native Next.js and has no dependency on the previous Sites/Cloudflare runtime or ChatGPT authentication. All routes work with Vercel’s normal Next.js integration.
