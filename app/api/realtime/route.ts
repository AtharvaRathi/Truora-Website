import {backendMode,currentUser,supabase} from '@/lib/backend';
import {json,apiError,ApiError} from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 // This endpoint exposes the current session token only to same-origin website JS.
 if(request.headers.get('sec-fetch-site')!=='same-origin'||request.headers.get('x-truora-client')!=='web')throw new ApiError('Forbidden.',403);
 const user=await currentUser();if(!user||backendMode()!=='supabase')throw new ApiError('Sign in required.',401);
 const db=await supabase();const {data:{session}}=await db.auth.getSession();if(!session)throw new ApiError('Sign in required.',401);
 return json({token:session.access_token,expiresAt:session.expires_at,userId:user.id});
}catch(e){return apiError(e)}}
