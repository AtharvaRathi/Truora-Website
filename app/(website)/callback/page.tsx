import { Suspense } from 'react';
import { RequestForm } from '@/components/request-form';
export const metadata={title:'Request a callback',robots:{index:false,follow:false}};
export default function Callback(){return <Suspense fallback={<main id="main" className="loading-page">Loading…</main>}><RequestForm callback/></Suspense>}
