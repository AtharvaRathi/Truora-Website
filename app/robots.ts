import type {MetadataRoute} from 'next';
import {siteUrl,isPreviewDeployment} from '@/lib/site-config';
export default function robots():MetadataRoute.Robots{return {rules:isPreviewDeployment?{userAgent:'*',disallow:'/'}:{userAgent:'*',allow:'/',disallow:['/workspace','/admin','/account','/api/']},sitemap:`${siteUrl}/sitemap.xml`}}
