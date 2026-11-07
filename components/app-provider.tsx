'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {useSharedCart} from './use-shared-cart';
import type { AppUser } from '@/lib/validation';
import type { CartLine } from '@/lib/catalog';

export async function api<T=Record<string,unknown>>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(`/api/${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Something went wrong. Please try again.');return data;
}
type AppState={user:AppUser|null;authLoading:boolean;backend:string;refreshUser:()=>Promise<void>;cart:CartLine[];cartLoaded:boolean;cartSyncError:string;addLine:(line:CartLine)=>void;updateQuantity:(index:number,quantity:number)=>void;removeLine:(index:number)=>void;clearCart:()=>void;setPackageLines:(slug:string,lines:CartLine[])=>void};
const AppContext=createContext<AppState|null>(null);
export function AppProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<AppUser|null>(null),[authLoading,setAuthLoading]=useState(true),[backend,setBackend]=useState(''),[catalogVersion,setCatalogVersion]=useState(0);
 async function refreshUser(){try{const data=await api<{user:AppUser|null;backend:string}>('auth/session');setUser(data.user);setBackend(data.backend)}catch{setUser(null);setBackend('unavailable')}finally{setAuthLoading(false)}}
 useEffect(()=>{void refreshUser();const focus=()=>{void refreshUser()};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[]);
 const {cart,cartLoaded,cartSyncError,guestDraft,importGuest,edit:setCart}=useSharedCart(user?.id,backend==='supabase');
 useEffect(()=>{const refresh=()=>setCatalogVersion(n=>n+1);window.addEventListener('truora:catalog',refresh);return()=>window.removeEventListener('truora:catalog',refresh)},[]);
 function addLine(line:CartLine){setCart(current=>{const match=current.findIndex(l=>l.productId===line.productId&&l.mode===line.mode&&l.days===line.days&&l.packageSlug===line.packageSlug);return match===-1?[...current,line]:current.map((l,i)=>i===match?{...l,quantity:Math.min(60,l.quantity+line.quantity)}:l)})}
 return <AppContext.Provider value={{user,authLoading,backend,refreshUser,cart,cartLoaded,cartSyncError,addLine,updateQuantity:(index,quantity)=>setCart(c=>c.map((l,i)=>i===index?{...l,quantity:Math.min(60,Math.max(1,quantity))}:l)),removeLine:index=>setCart(c=>c.filter((_,i)=>i!==index)),clearCart:()=>setCart(()=>[]),setPackageLines:(slug,lines)=>setCart(current=>[...current.filter(l=>l.packageSlug!==slug),...lines])}}><div key={`cart-error-${catalogVersion}`} hidden={!cartSyncError} role="alert" style={{padding:cartSyncError?12:0,background:"#fff0dc",color:"#733a12",textAlign:"center"}}>{cartSyncError}</div>{user&&guestDraft.length>0&&<div role="status" style={{padding:12,background:"#e4f0e7",textAlign:"center"}}>A guest bag is saved on this device. <button disabled={!cartLoaded} onClick={importGuest} style={{textDecoration:"underline"}}>Add its {guestDraft.length} selections to your account bag</button></div>}{children}</AppContext.Provider>;
}
export function useApp(){const app=useContext(AppContext);if(!app)throw new Error('AppProvider is required');return app}
