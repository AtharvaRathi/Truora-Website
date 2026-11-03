import type { Metadata } from 'next';
import { Catalog } from '@/components/catalog';
export const metadata:Metadata={title:'Rentals',description:'Explore demo BP Machine and Wheelchair rentals with seven-day and thirty-day options.',alternates:{canonical:'/rentals'}};
export default function Rentals(){return <Catalog rental/>}
