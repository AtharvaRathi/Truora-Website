// Vercel supplies the production hostname at build time, including on previews.
// Set NEXT_PUBLIC_SITE_URL to override it when attaching a custom domain.
const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const resolvedUrl = configuredUrl || (productionHost ? `https://${productionHost}` : 'http://localhost:5173');

const parsedUrl = new URL(resolvedUrl);
if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
  throw new Error('NEXT_PUBLIC_SITE_URL must be an http:// or https:// URL.');
}

export const siteUrl = parsedUrl.origin;
export const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';
