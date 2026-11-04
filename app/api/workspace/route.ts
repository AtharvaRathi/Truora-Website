import {backendMode,currentUser,supabase} from '@/lib/backend';
import {ApiError,apiError,json,readJson,sameOrigin} from '@/lib/api';
import {workspaceActionSchema} from '@/lib/workspace';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{
 const user=await currentUser();if(!user)throw new ApiError('Sign in to continue.',401);
 if(backendMode()==='local')return json(await (await import('@/lib/local-workspace')).localWorkspace(user.id));
 const {data,error}=await (await supabase()).rpc('workspace_snapshot');
 if(error)throw new ApiError(error.message==='Team access required'?'This account does not have team access.':'Unable to load the workspace.',error.message==='Team access required'?403:500);
 return json(data);
}catch(e){return apiError(e)}}
export async function POST(request:Request){try{
 sameOrigin(request);const input=workspaceActionSchema.parse(await readJson(request));const user=await currentUser();if(!user)throw new ApiError('Sign in to continue.',401);
 if(backendMode()==='local')return json(await (await import('@/lib/local-workspace')).localWorkspaceAction(user.id,input));
 const {data,error}=await (await supabase()).rpc('workspace_action',{p_input:input});
 if(error){const safe=/^(Team access required|Permission denied|Record changed|Invalid status|Task |Provider |Customer |Account |Cannot |Verify |Unknown |Choose |Start |Too many)/.test(error.message);throw new ApiError(safe?error.message:'Unable to save this change.',error.message.includes('Permission denied')||error.message==='Team access required'?403:error.message.startsWith('Record changed')?409:400)}
 return json(data);
}catch(e){return apiError(e)}}
