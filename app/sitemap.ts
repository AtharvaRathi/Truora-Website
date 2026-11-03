import type {MetadataRoute} from 'next';
import {surgeries} from '@/lib/content';
import {products} from '@/lib/catalog';
import {siteUrl} from '@/lib/site-config';
export default function sitemap():MetadataRoute.Sitemap{const base=siteUrl;return ['','/packages','/services','/products','/rentals','/how-it-works','/about','/contact','/privacy',...products.flatMap(p=>[`/products/${p.id}`,`/rentals/${p.id}`]),...surgeries.map(s=>`/packages/${s.slug}`)].map(p=>({url:`${base}${p}`,changeFrequency:'monthly',priority:p===''?1:0.7}))}
