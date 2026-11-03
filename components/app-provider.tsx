'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { lineSchema } from '@/lib/validation';
import type { AppUser } from '@/lib/validation';
import type { CartLine } from '@/lib/catalog';

export async function api<T=Record<string,unknown>>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(`/api/${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Something went wrong. Please try again.');return data;
}
type AppState={user:AppUser|null;authLoading:boolean;backend:string;refreshUser:()=>Promise<void>;cart:CartLine[];cartLoaded:boolean;addLine:(line:CartLine)=>void;updateQuantity:(index:number,quantity:number)=>void;removeLine:(index:number)=>void;clearCart:()=>void};
const AppContext=createContext<AppState|null>(null);
export function AppProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<AppUser|null>(null),[authLoading,setAuthLoading]=useState(true),[backend,setBackend]=useState(''),[cart,setCart]=useState<CartLine[]>([]),[cartLoaded,setCartLoaded]=useState(false);
 async function refreshUser(){try{const data=await api<{user:AppUser|null;backend:string}>('auth/session');setUser(data.user);setBackend(data.backend)}catch{setUser(null);setBackend('unavailable')}finally{setAuthLoading(false)}}
 useEffect(()=>{void refreshUser();const focus=()=>{void refreshUser()};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[]);
 useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem('truora-cart-v1')||'[]');const parsed=lineSchema.array().max(20).safeParse(stored);if(parsed.success)setCart(parsed.data)}catch{/* Start with an empty cart if local storage is unavailable. */}setCartLoaded(true)},[]);
 useEffect(()=>{if(cartLoaded)try{localStorage.setItem('truora-cart-v1',JSON.stringify(cart))}catch{/* The cart remains usable for this tab. */}},[cart,cartLoaded]);
 function addLine(line:CartLine){setCart(current=>{const match=current.findIndex(l=>l.productId===line.productId&&l.mode===line.mode&&l.days===line.days);return match===-1?[...current,line]:current.map((l,i)=>i===match?{...l,quantity:Math.min(10,l.quantity+line.quantity)}:l)})}
 return <AppContext.Provider value={{user,authLoading,backend,refreshUser,cart,cartLoaded,addLine,updateQuantity:(index,quantity)=>setCart(c=>c.map((l,i)=>i===index?{...l,quantity:Math.min(10,Math.max(1,quantity))}:l)),removeLine:index=>setCart(c=>c.filter((_,i)=>i!==index)),clearCart:()=>setCart([])}}>{children}</AppContext.Provider>;
}
export function useApp(){const app=useContext(AppContext);if(!app)throw new Error('AppProvider is required');return app}
