import {z} from 'zod';
import {backendMode,currentUser,supabase} from '@/lib/backend';
import {ApiError,apiError,json,readJson,sameOrigin} from '@/lib/api';
import {lineSchema} from '@/lib/validation';
import {rpcFailure} from '@/lib/mobile-backend';
export const dynamic='force-dynamic';
async function db(){if(!await currentUser())throw new ApiError('Sign in to continue.',401);if(backendMode()!=='supabase')throw new ApiError('Cross-device carts require online accounts.',503);return supabase()}
export async function GET(){try{const r=await (await db()).rpc('cart_snapshot');if(r.error)throw rpcFailure(r.error.message);return json(r.data)}catch(e){return apiError(e)}}
export async function POST(request:Request){try{sameOrigin(request);const i=z.object({lines:z.array(lineSchema).max(100),version:z.number().int().min(0)}).strict().parse(await readJson(request));const r=await (await db()).rpc('save_cart',{p_lines:i.lines,p_version:i.version});if(r.error)throw rpcFailure(r.error.message);return json(r.data)}catch(e){return apiError(e)}}
