import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { rentalProducts, getProduct } from '@/lib/catalog';
import { ProductDetail } from '@/components/catalog';
export function generateStaticParams(){return rentalProducts.map(p=>({id:p.id}))}
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;return {title:`Rent ${getProduct(id)?.name||'equipment'}`,alternates:{canonical:`/rentals/${id}`}}}
export default async function Rental({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!getProduct(id)?.rental7)notFound();return <ProductDetail id={id} rental/>}
