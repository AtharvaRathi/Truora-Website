import type {MetadataRoute} from 'next';
import {surgeries} from '@/lib/content';
import {siteUrl} from '@/lib/site-config';
export default function sitemap():MetadataRoute.Sitemap{const base=siteUrl;return ['','/packages','/how-it-works','/about','/contact','/privacy',...surgeries.map(s=>`/packages/${s.slug}`)].map(p=>({url:`${base}${p}`,changeFrequency:'monthly',priority:p===''?1:0.7}))}
