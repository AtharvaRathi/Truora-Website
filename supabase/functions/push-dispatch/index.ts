// Supabase Edge Function. Secrets stay here; never include them in either client.
Deno.serve(async(request:Request)=>{
 const secret=Deno.env.get('PUSH_DISPATCH_SECRET');
 if(request.method!=='POST'||!secret||request.headers.get('x-dispatch-secret')!==secret)return new Response('Forbidden',{status:403});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 async function rpc(name:string,body:unknown){const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key!,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('Database operation failed');return r.status===204?null:r.json()}
 try{
  const jobs=await rpc('claim_push_batch',{});let processed=0;
  for(const job of jobs){
   let success=false,error='',invalid:string[]=[];
   try{
    if(!job.tokens.length){success=true}else{
     const messages=job.tokens.map((to:string)=>({to,title:'Truora update',body:'Open Truora to view your latest updates.',data:{screen:'notifications'},channelId:'updates'}));
     const r=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(Deno.env.get('EXPO_ACCESS_TOKEN')?{Authorization:`Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`}:{})},body:JSON.stringify(messages)});
     if(!r.ok)throw new Error('Push service unavailable');const result=await r.json();if(!Array.isArray(result.data)||result.data.length!==messages.length)throw new Error('Invalid push response');
     success=true;result.data.forEach((ticket:{status:string;details?:{error?:string}},i:number)=>{if(ticket.status==='error'){if(ticket.details?.error==='DeviceNotRegistered')invalid.push(job.tokens[i]);else{success=false;error=ticket.details?.error||'Push ticket rejected'}}});
    }
   }catch{error='Push service unavailable'}
   await rpc('finish_push',{p_id:job.id,p_success:success,p_error:error,p_invalid_tokens:invalid});processed++;
  }
  return Response.json({processed});
 }catch{return Response.json({error:'Dispatch unavailable'},{status:503})}
});
