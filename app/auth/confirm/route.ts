import { NextResponse } from 'next/server';
import { supabase } from '@/lib/backend';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const url=new URL(request.url);const next=url.searchParams.get('next')==='/reset-password'?'/reset-password':'/account';
  try{
    const db=await supabase();const code=url.searchParams.get('code');const token=url.searchParams.get('token_hash');const type=url.searchParams.get('type');
    if(code){const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,url.origin))}
    else if(token&&(type==='signup'||type==='recovery'||type==='email')){const {error}=await db.auth.verifyOtp({token_hash:token,type});if(!error)return NextResponse.redirect(new URL(type==='recovery'?'/reset-password':next,url.origin))}
  }catch{/* Authentication errors are shown through the sign-in page. */}
  return NextResponse.redirect(new URL('/login?message=This%20confirmation%20link%20expired.%20Please%20try%20again.',url.origin));
}
