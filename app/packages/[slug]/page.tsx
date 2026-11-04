import {PackageBuilder} from '@/components/package-builder';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Check,ArrowRight,ChevronRight} from 'lucide-react';
import {BundleSection,Button,ContactCTA,Eyebrow,FAQ,PriceNote,SurgeryIcon} from '@/components/site';
import {surgeries,formatPrice} from '@/lib/content';
export function generateStaticParams(){return surgeries.map(s=>({slug:s.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const s=surgeries.find(s=>s.slug===slug);return {title:s?`${s.name} recovery`:'Package not found',description:s?.description,alternates:{canonical:`/packages/${slug}`}}}
export default async function PackagePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const s=surgeries.find(s=>s.slug===slug);if(!s)notFound();return <main id="main"><section className="page-hero package-hero"><div className="container"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={12}/><Link href="/packages">Packages</Link><ChevronRight size={12}/><span>{s.name}</span></nav><div className="package-hero-grid"><div><Eyebrow light>PLANNED ORTHOPEDIC RECOVERY PACKAGE</Eyebrow><h1>{s.name}<br/><span>recovery, brought home.</span></h1><p>{s.description}</p></div><div className="package-hero-art"><SurgeryIcon type={s.icon}/></div></div></div></section><PackageBuilder slug={slug}/><BundleSection/><section className="section"><div className="container faq-grid"><div><Eyebrow>GOOD TO KNOW</Eyebrow><h2>A little more<br/>clarity.</h2><Link className="text-link" href="/packages">Explore other surgeries <ArrowRight size={18}/></Link></div><FAQ/></div></section><ContactCTA/></main>}
