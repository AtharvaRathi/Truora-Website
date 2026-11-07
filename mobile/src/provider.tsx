import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {AppState,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Session,RealtimeChannel} from '@supabase/supabase-js';
import {disablePush} from './notifications';
import {supabase,request} from './backend';
import {installCatalog,type CartLine} from '../../packages/core/catalog';
import {installPackages} from '../../packages/core/packages';
import {lineSchema,type AppUser,type Order,type ServiceRequest} from '../../packages/core/validation';
import type {RecoveryPlan} from '../../packages/core/packages';
import type {CustomerVisit,TeamMember,WorkspaceData,WorkspaceAction} from '../../packages/core/workspace';
export type Account={user:AppUser;orders:Order[];requests:ServiceRequest[];recoveryPlans:RecoveryPlan[];visits:CustomerVisit[];member:TeamMember|null};
type State={session:Session|null;loading:boolean;account:Account|null;workspace:WorkspaceData|null;error:string;catalogReady:boolean;revision:number;cart:CartLine[];cartBusy:boolean;refresh:()=>Promise<void>;refreshWorkspace:()=>Promise<void>;action:(a:WorkspaceAction)=>Promise<void>;editCart:(f:(l:CartLine[])=>CartLine[])=>Promise<void>;signOut:()=>Promise<void>};
const Context=createContext<State|null>(null);
export function Provider({children}:{children:React.ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[account,setAccount]=useState<Account|null>(null),[workspace,setWorkspace]=useState<WorkspaceData|null>(null),[error,setError]=useState(''),[catalogReady,setCatalogReady]=useState(false),[revision,setRevision]=useState(0),[cart,setCart]=useState<CartLine[]>([]),[cartBusy,setCartBusy]=useState(false);
 const owner=useRef<string|null>(null),snapshot=useRef({lines:[] as CartLine[],version:0}),queue=useRef(Promise.resolve()),refreshSequence=useRef(0),workSequence=useRef(0),teamRole=useRef<string|null>(null);
 const refreshCatalog=useCallback(()=>request('catalog').then(data=>{installCatalog(data.items);installPackages(data.packages);setCatalogReady(true);setRevision(r=>r+1)}).catch(()=>{/* Bundled sample browsing remains available. */}),[]);
 const refresh=useCallback(async()=>{const id=owner.current;if(!id)return;const seq=++refreshSequence.current;await request<Account>('account').then(data=>{if(id===owner.current&&seq===refreshSequence.current){setAccount(data);setError('');teamRole.current=data.member?.role||null;if(!data.member)setWorkspace(null)}}).catch(e=>{if(id===owner.current){setError(e.message||'Unable to load account.');setAccount(null);setWorkspace(null);teamRole.current=null}})},[]);
 const refreshWorkspace=useCallback(async()=>{const id=owner.current;if(!id)return;const seq=++workSequence.current;await request<WorkspaceData>('workspace').then(data=>{if(id===owner.current&&seq===workSequence.current){setWorkspace(data);setError('')}}).catch(e=>{if(id===owner.current){setWorkspace(null);setError(e.message||'Unable to load workspace.')}})},[]);
 const pullCart=useCallback(async()=>{const id=owner.current;if(!id)return;const data=await request('cart');if(id===owner.current&&data.version>=snapshot.current.version){snapshot.current=data;setCart(data.lines)}},[]);
 useEffect(()=>{
  let active=true;
  function applySession(next:Session|null){if(!active)return;if(owner.current!==(next?.user.id||null)){owner.current=next?.user.id||null;teamRole.current=null;setAccount(null);setWorkspace(null);setCart([]);setCartBusy(false);setError('');snapshot.current={lines:[],version:0};queue.current=Promise.resolve()}setSession(next);setLoading(false)}
  if(supabase)void supabase.auth.getSession().then(({data})=>applySession(data.session));else queueMicrotask(()=>{if(active)setLoading(false)});
  const listener=supabase?.auth.onAuthStateChange((_event,next)=>applySession(next));void refreshCatalog();return()=>{active=false;listener?.data.subscription.unsubscribe()};
 },[refreshCatalog]);
 const userId=session?.user.id;
 useEffect(()=>{
  const id=userId||null;let active=true;let debounce:ReturnType<typeof setTimeout>|undefined;
  function changed(){clearTimeout(debounce);debounce=setTimeout(()=>{if(!active)return;void refresh();void pullCart().catch(()=>{});if(teamRole.current)void refreshWorkspace()},250)}
  if(id){void refresh();void pullCart().catch(e=>{if(active)setError(e.message)})}else void AsyncStorage.getItem('truora:guest-cart').then(raw=>{if(active&&!owner.current&&raw){try{const parsed=lineSchema.array().max(100).safeParse(JSON.parse(raw));if(parsed.success){snapshot.current={lines:parsed.data,version:0};setCart(parsed.data)}}catch{}}});
  const channels:RealtimeChannel[]=[];
  async function connect(){if(!supabase)return;const {data}=await supabase.auth.getSession();if(data.session)await supabase.realtime.setAuth(data.session.access_token);if(!active)return;channels.push(supabase.channel('catalog',{config:{private:true}}).on('broadcast',{event:'change'},()=>void refreshCatalog()).subscribe());if(id)channels.push(supabase.channel(`user:${id}`,{config:{private:true}}).on('broadcast',{event:'change'},changed).subscribe(s=>{if(s==='SUBSCRIBED')changed()}))}
  void connect();const state=AppState.addEventListener('change',s=>{if(s==='active'){supabase?.auth.startAutoRefresh();changed();void refreshCatalog()}else supabase?.auth.stopAutoRefresh()});if(Platform.OS==='web')window.addEventListener('focus',changed);
  return()=>{active=false;clearTimeout(debounce);state.remove();if(Platform.OS==='web')window.removeEventListener('focus',changed);channels.forEach(c=>{void supabase?.removeChannel(c)})};
 },[userId,refresh,refreshWorkspace,refreshCatalog,pullCart]);
 const token=session?.access_token;
 useEffect(()=>{if(token&&supabase)void supabase.realtime.setAuth(token)},[token]);
 const role=account?.member?.role;
 useEffect(()=>{if(!supabase||!role||role==='provider')return;const channel=supabase.channel('operations',{config:{private:true}}).on('broadcast',{event:'change'},()=>void refreshWorkspace()).subscribe(s=>{if(s==='SUBSCRIBED')void refreshWorkspace()});return()=>{void supabase?.removeChannel(channel)}},[role,userId,refreshWorkspace]);
 async function editCart(fn:(lines:CartLine[])=>CartLine[]){const id=owner.current;setCartBusy(true);let failure:unknown;queue.current=queue.current.catch(()=>{}).then(async()=>{if(owner.current!==id)return;try{const lines=fn(snapshot.current.lines);lineSchema.array().max(100).parse(lines);let next={lines,version:snapshot.current.version};if(id)next=await request('cart',next);else await AsyncStorage.setItem('truora:guest-cart',JSON.stringify(lines));if(owner.current===id){snapshot.current=next;setCart(next.lines)}}catch(e){failure=e;if(owner.current===id){setError(e instanceof Error?e.message:'Unable to save cart.');if(id)await pullCart().catch(()=>{})}}finally{if(owner.current===id)setCartBusy(false)}});await queue.current;if(failure)throw failure}
 async function action(input:WorkspaceAction){await request('workspace',input);await Promise.all([refreshWorkspace(),refresh()])}
 async function signOut(){if(supabase){await disablePush().catch(()=>{});const result=await supabase.auth.signOut();if(result.error){setError('Unable to log out. Check your connection and try again.');throw new Error('Unable to log out.')}setWorkspace(null);setAccount(null);setError('')}}
 return <Context.Provider value={{session,loading,account,workspace,error,catalogReady,revision,cart,cartBusy,refresh,refreshWorkspace,action,editCart,signOut}}>{children}</Context.Provider>;
}
export function useTruora(){const state=useContext(Context);if(!state)throw new Error('Truora provider missing');return state}
