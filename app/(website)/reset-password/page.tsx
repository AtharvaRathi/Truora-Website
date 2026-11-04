import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth-screen';
export const metadata={title:'Reset password',robots:{index:false,follow:false}};
export default function Reset(){return <Suspense fallback={<main id="main" className="loading-page">Loading…</main>}><AuthScreen mode="reset"/></Suspense>}
