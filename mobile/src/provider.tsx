import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {AppState,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Session} from '@supabase/supabase-js';
import {disablePush} from './notifications';
import {supabase,request} from './backend';
import {catalog,installCatalog,type CartLine} from '../../packages/core/catalog';
import {installPackages} from '../../packages/core/packages';
import {lineSchema,type AppUser,type Order,type ServiceRequest} from '../../packages/core/validation';
import type {RecoveryPlan} from '../../packages/core/packages';
import type {CustomerVisit,TeamMember,WorkspaceData,WorkspaceAction} from '../../packages/core/workspace';
export type Account={user:AppUser;orders:Order[];requests:ServiceRequest[];recoveryPlans:RecoveryPlan[];visits:CustomerVisit[];member:TeamMember|null};
type State={session:Session|null;loading:boolean;account:Account|null;workspace:WorkspaceData|null;error:string;catalogReady:boolean;revision:number;cart:CartLine[];cartBusy:boolean;refresh:()=>Promise<void>;refreshWorkspace:()=>Promise<void>;action:(a:WorkspaceAction)=>Promise<void>;editCart:(f:(l:CartLine[])=>CartLine[])=>Promise<void>;signOut:()=>Promise<void>};
const Context=createContext<State|null>(null);
export function Provider({children}:{children:React.ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[account,setAccount]=useState<Account|null>(null),[workspace,setWorkspace]=useState<WorkspaceData|null>(null),[error,setError]=useState(''),[catalogReady,setCatalogReady]=useState(false),[revision,setRevision]=useState(0),[cart,setCart]=useState<CartLine[]>([]),[cartBusy,setCartBusy]=useState(false);
 const owner=useRef<string|null>(null),snapshot=useRef({lines:[] as CartLine[],version:0}),queue=useRef(Promise.resolve()),refreshSequence=useRef(0),workSequence=useRef(0);owner.current=session?.user.id||null;
 async function refreshCatalog(){try{const data=await request('catalog');installCatalog(data.items);installPackages(data.packages);setCatalogReady(true);setRevision(r=>r+1)}catch{/* Bundled sample catalog remains browsable, checkout remains disabled. */}}
 async function refresh(){const id=owner.current;if(!id)return;const seq=++refreshSequence.current;try{const data=await request<Account>('account');if(id===owner.current&&seq===refreshSequence.current){setAccount(data);setError('');if(!data.member)setWorkspace(null)}}catch(e){if(id===owner.current){setError(e instanceof Error?e.message:'Unable to load account.');setAccount(null);setWorkspace(null)}}}
 async function refreshWorkspace(){const id=owner.current;if(!id)return;const seq=++workSequence.current;try{const d=await request<WorkspaceData>('workspace');if(id===owner.current&&seq===workSequence.current){setWorkspace(d);setError('')}}catch(e){if(id===owner.current){setWorkspace(null);setError(e instanceof Error?e.message:'Unable to load workspace.')}}}
 async function pullCart(){const id=owner.current;if(!id)return;const d=await request('cart');if(id===owner.current&&d.version>=snapshot.current.version){snapshot.current=d;setCart(d.lines)}}
 const refs=useRef({refresh,refreshWorkspace,refreshCatalog,pullCart});refs.current={refresh,refreshWorkspace,refreshCatalog,pullCart};
 useEffect(()=>{let active=true;void supabase?.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});if(!supabase)setLoading(false);const listener=supabase?.auth.onAuthStateChange((_event,s)=>{if(active)setSession(s)});void refreshCatalog();return()=>{active=false;listener?.data.subscription.unsubscribe()}},[]);
 useEffect(()=>{
  const id=session?.user.id||null;let active=true;let debounce:ReturnType<typeof setTimeout>|undefined;
  setAccount(null);setWorkspace(null);setCart([]);snapshot.current={lines:[],version:0};queue.current=Promise.resolve();setCartBusy(false);
  function changed(){clearTimeout(debounce);debounce=setTimeout(()=>{if(!active)return;void refs.current.refresh();void refs.current.pullCart().catch(()=>{});if(accountRole.current)void refs.current.refreshWorkspace()},250)}
  if(id){void refs.current.refresh();void refs.current.pullCart().catch(e=>setError(e.message))}else void AsyncStorage.getItem('truora:guest-cart').then(raw=>{if(active&&raw){try{const result=lineSchema.array().max(100).safeParse(JSON.parse(raw));if(result.success){snapshot.current={lines:result.data,version:0};setCart(result.data)}}catch{}}});
  const channels:supabaseChannel[]=[];
  async function connect(){if(!supabase)return;if(session)await supabase.realtime.setAuth(session.access_token);if(!active)return;
   channels.push(supabase.channel('catalog',{config:{private:true}}).on('broadcast',{event:'change'},()=>void refs.current.refreshCatalog()).subscribe());
   if(id)channels.push(supabase.channel(`user:${id}`,{config:{private:true}}).on('broadcast',{event:'change'},changed).subscribe(s=>{if(s==='SUBSCRIBED')changed()}));
  }
  void connect();const state=AppState.addEventListener('change',s=>{if(s==='active'){supabase?.auth.startAutoRefresh();changed();void refs.current.refreshCatalog()}else supabase?.auth.stopAutoRefresh()});
  const webFocus=()=>changed();if(Platform.OS==='web')window.addEventListener('focus',webFocus);
  return()=>{active=false;clearTimeout(debounce);state.remove();if(Platform.OS==='web')window.removeEventListener('focus',webFocus);channels.forEach(c=>{void supabase?.removeChannel(c)})};
 },[session?.user.id]);
 const accountRole=useRef(false);accountRole.current=!!account?.member;
 useEffect(()=>{if(!supabase||!session)return;void supabase.realtime.setAuth(session.access_token)},[session?.access_token]);
 useEffect(()=>{if(!supabase||!account?.member||account.member.role==='provider')return;const c=supabase.channel('operations',{config:{private:true}}).on('broadcast',{event:'change'},()=>void refs.current.refreshWorkspace()).subscribe(s=>{if(s==='SUBSCRIBED')void refs.current.refreshWorkspace()});return()=>{void supabase?.removeChannel(c)}},[account?.member?.role,session?.user.id]);
 async function editCart(fn:(lines:CartLine[])=>CartLine[]){const id=owner.current;setCartBusy(true);let failure:unknown;
  queue.current=queue.current.catch(()=>{}).then(async()=>{if(owner.current!==id)return;try{const lines=fn(snapshot.current.lines);lineSchema.array().max(100).parse(lines);let next={lines,version:snapshot.current.version};if(id)next=await request('cart',next);else await AsyncStorage.setItem('truora:guest-cart',JSON.stringify(lines));if(owner.current===id){snapshot.current=next;setCart(next.lines)}}catch(e){failure=e;setError(e instanceof Error?e.message:'Unable to save cart.');if(id)await pullCart().catch(()=>{})}finally{setCartBusy(false)}});await queue.current;if(failure)throw failure;
 }
 async function action(input:WorkspaceAction){await request('workspace',input);await Promise.all([refreshWorkspace(),refresh()])}
 async function signOut(){if(supabase){await disablePush().catch(()=>{});await supabase.auth.signOut();setWorkspace(null);setAccount(null);setError('')}}
 return <Context.Provider value={{session,loading,account,workspace,error,catalogReady,revision,cart,cartBusy,refresh,refreshWorkspace,action,editCart,signOut}}>{children}</Context.Provider>
}
type supabaseChannel=NonNullable<typeof supabase> extends {channel:(...a:any[])=>infer C}?C:never;
export function useTruora(){const c=useContext(Context);if(!c)throw new Error('Truora provider missing');return c}
