import { ZodError } from 'zod';
export class ApiError extends Error { constructor(message:string,public status=400){super(message)} }
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export function sameOrigin(request:Request){
 const origin=request.headers.get('origin');let valid=false;
 try{const parsed=new URL(origin||'');valid=['http:','https:'].includes(parsed.protocol)&&parsed.host===request.headers.get('host')}catch{}
 if(!valid)throw new ApiError('This request could not be verified. Refresh the page and try again.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))throw new ApiError('Use a JSON request.',415);
}
export async function readJson(request:Request){const text=await request.text();if(text.length>20000)throw new ApiError('Request is too large.',413);try{return JSON.parse(text)}catch{throw new ApiError('Invalid request.')}}
export function apiError(error:unknown){ if(error instanceof ZodError)return json({error:error.issues[0]?.message||'Check the form fields.'},400);if(error instanceof ApiError)return json({error:error.message},error.status);if(error instanceof Error){const safe=/^(Email or password|Unable to create this account|Too many attempts|This reset link|Online accounts|Unable to load your profile)/.test(error.message);if(safe)return json({error:error.message},error.message.startsWith('Online accounts')?503:400)}console.error('Truora API request failed');return json({error:'We couldn’t complete that request. Please try again.'},500);}
