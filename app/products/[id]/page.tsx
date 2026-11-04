import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { products, getProduct } from '@/lib/catalog';
import { ProductDetail } from '@/components/catalog';
export function generateStaticParams(){return products.filter(p=>p.price>0).map(p=>({id:p.id}))}
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;return {title:getProduct(id)?.name||'Product',alternates:{canonical:`/products/${id}`}}}
export default async function Product({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!getProduct(id)?.price||getProduct(id)?.kind==='service')notFound();return <ProductDetail id={id}/>}
