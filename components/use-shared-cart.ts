'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CartLine} from '@/lib/catalog';
import {mergeCart} from '@/packages/core/cart';
import {lineSchema} from '@/lib/validation';
type Snapshot={lines:CartLine[];version:number};
export function useSharedCart(userId:string|undefined,online:boolean){
 const [cart,setCart]=useState<CartLine[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[guestDraft,setGuestDraft]=useState<CartLine[]>([]);
 const current=useRef<Snapshot>({lines:[],version:0}),owner=useRef(''),queue=useRef(Promise.resolve()),ready=useRef(false);
 const activeOwner=userId||'guest';owner.current=activeOwner;
 const pull=useCallback(async()=>{const r=await fetch('/api/cart',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to sync your cart.');return d as Snapshot},[]);
 useEffect(()=>{
  const id=activeOwner;let active=true;ready.current=false;setLoaded(false);setCart([]);setError('');queue.current=Promise.resolve();
  async function load(){try{
   let snapshot:Snapshot={lines:[],version:0};
   if(online&&userId){snapshot=await pull();try{const guest=lineSchema.array().max(100).safeParse(JSON.parse(localStorage.getItem('truora-cart-v2')||'[]'));if(active&&guest.success)setGuestDraft(guest.data)}catch{}}else{try{const stored=JSON.parse(localStorage.getItem(userId?`truora-cart:${userId}`:'truora-cart-v2')||'[]');const parsed=lineSchema.array().max(100).safeParse(stored);if(parsed.success)snapshot.lines=parsed.data}catch{}}
   if(active&&owner.current===id){current.current=snapshot;setCart(snapshot.lines);ready.current=true}
  }catch(e){if(active)setError(e instanceof Error?e.message:'Unable to sync cart.')}finally{if(active)setLoaded(true)}}
  void load();
  const sync=()=>{if(!online||!userId)return;queue.current=queue.current.then(async()=>{try{const s=await pull();if(active&&owner.current===id){current.current=s;setCart(s.lines);ready.current=true;setError('')}}catch{}})};
  window.addEventListener('truora:change',sync);window.addEventListener('focus',sync);window.addEventListener('online',sync);
  return()=>{active=false;window.removeEventListener('truora:change',sync);window.removeEventListener('focus',sync);window.removeEventListener('online',sync)};
 },[activeOwner,online,userId,pull]);
 function edit(fn:(lines:CartLine[])=>CartLine[],after?:()=>void){const id=activeOwner;
  queue.current=queue.current.then(async()=>{
   if(owner.current!==id||!ready.current)return;
   const next=fn(current.current.lines);if(!lineSchema.array().max(100).safeParse(next).success){setError('Your cart has reached its limit.');return}
   try{
    let s:Snapshot={lines:next,version:current.current.version};
    if(online&&userId){const r=await fetch('/api/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:next,version:current.current.version})});const d=await r.json();if(!r.ok){if(r.status===409){const fresh=await pull();if(owner.current===id){current.current=fresh;setCart(fresh.lines)}}throw new Error(d.error||'Unable to save your cart.')}s=d}
    else localStorage.setItem(userId?`truora-cart:${userId}`:'truora-cart-v2',JSON.stringify(next));
    if(owner.current===id){current.current=s;setCart(s.lines);setError('');after?.()}
   }catch(e){if(owner.current===id)setError(e instanceof Error?e.message:'Unable to save cart.')}
  });
 }
 return {cart,cartLoaded:loaded,cartSyncError:error,edit,guestDraft,importGuest:()=>edit(c=>mergeCart(c,guestDraft),()=>{localStorage.removeItem('truora-cart-v2');setGuestDraft([])})};
}
