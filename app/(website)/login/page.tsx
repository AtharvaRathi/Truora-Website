import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth-screen';
export const metadata={title:'Log in',robots:{index:false,follow:false}};
export default function Login(){return <Suspense fallback={<main id="main" className="loading-page">Loading…</main>}><AuthScreen mode="login"/></Suspense>}
