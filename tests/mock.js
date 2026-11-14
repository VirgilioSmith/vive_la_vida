(function(){
 const user={id:'00000000-0000-0000-0000-000000000001',email:'demo@example.com'};
 const res=(v)=>Promise.resolve(v);
 function q(table){
  const st={table};
  const p=new Proxy(function(){}, {
   get(t,k){
    if(k==='then'){
      let out={data:null,error:null,count:0};
      out.data=(table==='finance_items'||table==='finance_values')?[]:null;
      return (a,b)=>res(out).then(a,b);
    }
    return (...args)=>p;
   }
  });
  return p;
 }
 const chan={on(){return chan},subscribe(cb){setTimeout(()=>cb&&cb('SUBSCRIBED'),10);return chan},unsubscribe(){}};
 window.supabase={createClient(){return{
  auth:{getUser:()=>res({data:{user},error:null}),getSession:()=>res({data:{session:{user,access_token:'x'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:()=>res({}),refreshSession:()=>res({data:{session:{user}},error:null})},
  from:q,rpc:(name,args)=>res({data:name==='finance_apply_changes'?Number(args?.p_expected_revision||0)+1:null,error:null}),channel:()=>chan,removeChannel:()=>res(),removeAllChannels:()=>res(),
  functions:{invoke:()=>res({data:null,error:null})},
  storage:{from:()=>({upload:()=>res({}),getPublicUrl:()=>({data:{publicUrl:''}})})}
 }}};
})();
