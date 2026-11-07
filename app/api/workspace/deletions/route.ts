import {z} from 'zod';import {supabase,currentUser,backendMode} from '@/lib/backend';import {json,apiError,ApiError,sameOrigin,readJson} from '@/lib/api';import {rpcFailure} from '@/lib/mobile-backend';
export const dynamic='force-dynamic';
async function db(){if(!await currentUser())throw new ApiError('Sign in required.',401);if(backendMode()!=='supabase')throw new ApiError('Deletion requests are available for hosted accounts.',503);return supabase()}
export async function GET(){try{const r=await(await db()).rpc('workspace_deletion_requests');if(r.error)throw rpcFailure(r.error.message);return json(r.data)}catch(e){return apiError(e)}}
export async function POST(request:Request){try{sameOrigin(request);const {userId}=z.object({userId:z.string().uuid()}).parse(await readJson(request));const r=await(await db()).rpc('review_account_deletion',{p_user:userId});if(r.error)throw rpcFailure(r.error.message);return json({ok:true})}catch(e){return apiError(e)}}
