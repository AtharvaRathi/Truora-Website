import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth-screen';
export const metadata={title:'Create an account',robots:{index:false,follow:false}};
export default function Signup(){return <Suspense fallback={<main id="main" className="loading-page">Loading…</main>}><AuthScreen mode="signup"/></Suspense>}
