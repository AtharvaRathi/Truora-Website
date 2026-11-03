import type { Metadata } from 'next';
import { Catalog } from '@/components/catalog';
export const metadata:Metadata={title:'Products',description:'Explore Truora’s demo BP Machine and Wheelchair product catalog.',alternates:{canonical:'/products'}};
export default function Products(){return <Catalog/>}
