/** Vive el hoy · Apple Pay v2: enlazar/renovar tokens y revocar vínculos. */
import { createClient } from 'npm:@supabase/supabase-js@2';
const HEADERS = {
  'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
};
const reply = (body: Record<string,unknown>, status=200) => new Response(
  JSON.stringify({version:'apple-pay-v2',...body}),{status,headers:HEADERS});
function serviceKey(): string {
  const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(legacy)return legacy;
  try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');return typeof keys.default==='string'?keys.default:'';}
  catch{return '';}
}
async function sha256(s:string){const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function token(){const bytes=crypto.getRandomValues(new Uint8Array(32));
  return 'vhap_'+[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
const clean=(v:unknown,max=120)=>typeof v==='string'?v.trim().slice(0,max):'';
Deno.serve(async(request:Request):Promise<Response>=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
  if(!['POST','DELETE'].includes(request.method))return reply({ok:false,code:'method_not_allowed'},405);
  const jwt=/^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!jwt)return reply({ok:false,code:'missing_user_jwt'},401);
  const url=Deno.env.get('SUPABASE_URL')||'', key=serviceKey();
  if(!url||!key)return reply({ok:false,code:'server_config'},503);
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await admin.auth.getUser(jwt);
  if(authError||!auth.user?.id)return reply({ok:false,code:'invalid_user_jwt'},401);
  const userId=auth.user.id;
  let body:Record<string,unknown>;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>8192)return reply({ok:false,code:'body_too_large'},413);
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error('object_expected');
    body=parsed as Record<string,unknown>;
  }catch{return reply({ok:false,code:'invalid_json'},400);}
  if(request.method==='DELETE'){
    const linkId=clean(body.link_id,80);
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(linkId))return reply({ok:false,code:'invalid_link_id'},422);
    // Preserva las compras históricas y mantiene el contrato DELETE de la app.
    // Requiere RPC apple_pay_remove_link existente y verificado.
    const removed=await admin.rpc('apple_pay_remove_link',{p_user_id:userId,p_link_id:linkId});
    if(removed.error){console.error('apple_pay_remove_link_failed',{code:removed.error.code,message:removed.error.message});
      return reply({ok:false,code:'delete_migration_required',error:'Revisa el RPC apple_pay_remove_link; no se eliminó ningún movimiento.'},500);}
    const row=Array.isArray(removed.data)?removed.data[0]:removed.data;
    if(!row?.deleted)return reply({ok:false,code:'link_not_found'},404);
    return reply({ok:true,deleted:true,revoked:true,retained_events:Number(row.retained_events||0),
      message:'Vínculo eliminado. Eventos y movimientos anteriores conservados.'});
  }
  const instrumentType=clean(body.instrument_type,20), instrumentId=clean(body.instrument_id,160);
  const currency=clean(body.currency,10).toUpperCase(), label=clean(body.card_label,120)||'Tarjeta';
  if(instrumentType!=='card'||!instrumentId||!['DOP','USD'].includes(currency))
    return reply({ok:false,code:'invalid_card'},422);
  // Check ownership in the current relational finance schema.
  // A card belongs to the authenticated user only when finance_items contains its id.
  const owned=await admin.from('finance_items').select('record_id')
    .eq('user_id',userId).eq('collection','cards')
    .eq('record_id',instrumentId).maybeSingle();
  if(owned.error){
    console.error('apple_pay_card_lookup_failed',{code:owned.error.code,message:owned.error.message});
    return reply({ok:false,code:'card_ownership_check_failed'},500);
  }
  if(!owned.data)return reply({ok:false,code:'card_not_owned'},403);
  const existing=await admin.from('apple_pay_links').select('id,active')
    .eq('user_id',userId).eq('instrument_type','card').eq('instrument_id',instrumentId)
    .eq('currency',currency).limit(2);
  if(existing.error)return reply({ok:false,code:'link_lookup_failed'},500);
  if((existing.data||[]).length>1)return reply({ok:false,code:'duplicate_links_need_review'},409);
  const secret=token(), hash=await sha256(secret), now=new Date().toISOString();
  let id:string, reused=false;
  if(existing.data?.[0]){
    const old=existing.data[0];
    const write=await admin.from('apple_pay_links').update({active:true,token_hash:hash,card_label:label,updated_at:now})
      .eq('id',old.id).eq('user_id',userId).select('id').single();
    if(write.error||!write.data)return reply({ok:false,code:'link_rotation_failed'},500);
    id=write.data.id; reused=true;
  }else{
    const write=await admin.from('apple_pay_links').insert({user_id:userId,instrument_type:'card',
      instrument_id:instrumentId,currency,card_label:label,token_hash:hash,active:true,
      created_at:now,updated_at:now}).select('id').single();
    if(write.error||!write.data)return reply({ok:false,code:'link_create_failed',db_code:write.error?.code||null},500);
    id=write.data.id;
  }
  const base=url.replace(/\/$/,'');
  return reply({ok:true,linked:true,reused,link_id:id,token:secret,currency,instrument_id:instrumentId,
    webhook_url:base+'/functions/v1/apple-pay-ingest',shortcuts_url:base+'/functions/v1/apple-pay-shortcuts',
    message:'Clave emitida una sola vez. Guárdala en el iPhone.'});
});
