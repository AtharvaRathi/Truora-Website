import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth-screen';
export const metadata={title:'Forgot password',robots:{index:false,follow:false}};
export default function Forgot(){return <Suspense fallback={<main id="main" className="loading-page">Loading…</main>}><AuthScreen mode="forgot"/></Suspense>}
