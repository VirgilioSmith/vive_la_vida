/* Vive el Hoy · V219 — Service worker mínimo, sin caché de datos financieros.
   Web Push funciona solo si el usuario tiene una suscripción válida y el backend
   de Supabase envía una notificación al endpoint de esa suscripción. */
'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let message={};
 try{if(event.data)message=event.data.json()||{}}catch(error){message={body:event.data?.text()||''}}
 const payload=message.notification&&typeof message.notification==='object'?message.notification:message;
 const title=String(payload.title||'vive el hoy').slice(0,100);
 const body=String(payload.body||'Tienes un recordatorio financiero disponible.').slice(0,250);
 const tag=String(payload.tag||'vive-finanzas-aviso').slice(0,70);
 const url=String(payload.url||payload.data?.url||message.data?.url||'./').slice(0,250);
 const opts={body,tag,icon:'./apple-touch-icon-v201.png',badge:'./favicon-v201.png',data:{url}};
 event.waitUntil(self.registration.showNotification(title,opts));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const base=new URL(self.registration.scope);
  let destination=base.href;
  try{const target=new URL(String(event.notification.data?.url||'./'),base);if(target.origin===base.origin)destination=target.href}catch(error){}
  const openClients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of openClients){
   if(new URL(client.url).origin===base.origin){
    await client.focus();
    if(client.navigate&&client.url!==destination)await client.navigate(destination);
    return;
   }
  }
  if(self.clients.openWindow)await self.clients.openWindow(destination);
 })());
});
