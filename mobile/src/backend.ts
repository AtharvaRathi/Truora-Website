import {createClient,processLock} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
export const apiUrl=(process.env.EXPO_PUBLIC_API_URL||'https://truora-five.vercel.app').replace(/\/$/,'');
const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured=!!url&&!!key;
// Large sessions are chunked to avoid platform secure-storage value limits.
const storage={
 async getItem(k:string){if(Platform.OS==='web')return sessionStorage.getItem(k);const size=await SecureStore.getItemAsync(k+'.count');if(!size)return null;let value='';for(let i=0;i<Number(size);i++){const chunk=await SecureStore.getItemAsync(`${k}.${i}`);if(chunk===null)return null;value+=chunk}return value},
 async setItem(k:string,v:string){if(Platform.OS==='web'){sessionStorage.setItem(k,v);return}await this.removeItem(k);const chunks=Math.ceil(v.length/1500);for(let i=0;i<chunks;i++)await SecureStore.setItemAsync(`${k}.${i}`,v.slice(i*1500,(i+1)*1500));await SecureStore.setItemAsync(k+'.count',String(chunks))},
 async removeItem(k:string){if(Platform.OS==='web'){sessionStorage.removeItem(k);return}const size=Number(await SecureStore.getItemAsync(k+'.count')||0);for(let i=0;i<size;i++)await SecureStore.deleteItemAsync(`${k}.${i}`);await SecureStore.deleteItemAsync(k+'.count')},
};
export const supabase=configured?createClient(url!,key!,{auth:{storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce',lock:processLock}}):null;
export class NetworkError extends Error{constructor(message:string,public status=0){super(message)}}
export async function request<T=any>(path:string,body?:unknown):Promise<T>{
 const session=await supabase?.auth.getSession();const token=session?.data.session?.access_token;
 const response=await fetch(`${apiUrl}/api/mobile/v1/${path}`,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({error:'The server is unavailable. Try again shortly.'}));
 if(!response.ok)throw new NetworkError(data.error||'Unable to complete request.',response.status);return data;
}
