/* VIVE Wrapped · UI independiente; sin notificaciones push ni escrituras financieras. */
(function(){
 'use strict';
 const E=window.ViveWrappedEngine;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=s=>new Intl.DateTimeFormat('es-DO',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
 const range=p=>p.start===p.end?date(p.end):date(p.start)+' — '+date(p.end);
 let active=null,opener=null;
 function inbox(asOf){
  return '<section class="vw-inbox" aria-label="VIVE Wrapped"><div class="vw-inbox-brand"><span>vive el hoy</span><b>Wrapped</b></div><p>Tu vida contada en historias.</p><div class="vw-list">'+E.kinds.map(k=>{const p=E.period(k,asOf);return '<button type="button" data-vwrapped="'+k+'" class="vw-entry"><span><strong>'+esc(p.title)+'</strong><small>'+esc(range(p))+'</small></span><span aria-hidden="true">↗</span></button>'}).join('')+'</div></section>';
 }
 function render(){
  const {dialog,p,slides,i}=active,s=slides[i];
  dialog.dataset.theme=s.theme;
  dialog.querySelector('.vw-progress').innerHTML=slides.map((_,j)=>'<i class="'+(j<=i?'done':'')+'"></i>').join('');
  dialog.querySelector('.vw-story-copy').innerHTML='<small>'+esc(range(p))+'</small><h2 id="vw-title">'+esc(s.title)+'</h2><div class="vw-value">'+esc(s.value)+'</div><p>'+esc(s.detail)+'</p>';
  dialog.querySelector('.vw-count').textContent=(i+1)+' / '+slides.length;
  dialog.querySelector('[data-vw-prev]').disabled=i===0;
  dialog.querySelector('[data-vw-next]').textContent=i===slides.length-1?'Finalizar':'Siguiente';
  dialog.querySelector('[data-vw-newer]').disabled=p.offset===0;
  dialog.querySelector('[data-vw-older]').disabled=p.offset>=1199;
 }
 function load(kind,offset){
  const host=window.ViveWrappedHost;
  const p=E.period(kind,host.asOf(),offset),previous=E.period(kind,host.asOf(),offset+1);
  active.p=p;active.i=0;active.slides=E.story(p,host.amounts(p.start,p.end),host.amounts(previous.start,previous.end));render();
 }
 function open(kind,source){
  if(!window.ViveWrappedHost||!E.kinds.includes(kind))return;
  if(active)active.dialog.close();
  opener=source||document.activeElement;
  const d=document.createElement('dialog');d.className='vw-dialog';d.setAttribute('aria-labelledby','vw-title');
  d.innerHTML='<div class="vw-frame"><header><div class="vw-wordmark">vive el hoy <b>Wrapped</b></div><button type="button" data-vw-close aria-label="Cerrar Wrapped">×</button></header><div class="vw-progress" aria-hidden="true"></div><nav class="vw-period-nav" aria-label="Historial de períodos"><button type="button" data-vw-older>‹ Anterior período</button><button type="button" data-vw-newer>Más reciente ›</button></nav><main class="vw-story-copy" aria-live="polite"></main><footer><button type="button" data-vw-prev>Anterior</button><span class="vw-count"></span><button type="button" data-vw-next>Siguiente</button></footer></div>';
  document.body.append(d);active={dialog:d};
  function close(){d.close()}
  d.addEventListener('close',()=>{d.remove();if(active?.dialog===d){active=null;opener?.focus?.();opener=null}});
  d.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;if(b.hasAttribute('data-vw-close'))close();else if(b.hasAttribute('data-vw-prev')){if(active.i>0){active.i--;render()}}else if(b.hasAttribute('data-vw-next')){if(active.i===active.slides.length-1)close();else{active.i++;render()}}else if(b.hasAttribute('data-vw-older'))load(kind,active.p.offset+1);else if(b.hasAttribute('data-vw-newer'))load(kind,active.p.offset-1)});
  d.addEventListener('keydown',ev=>{if(ev.key==='ArrowRight'||ev.key==='ArrowLeft'){ev.preventDefault();const n=active.i+(ev.key==='ArrowRight'?1:-1);if(n>=0&&n<active.slides.length){active.i=n;render()}}});
  try{load(kind,0);d.showModal();d.querySelector('[data-vw-close]').focus()}catch(e){d.remove();active=null;console.error('VIVE Wrapped:',e)}
 }
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-vwrapped]');if(!b)return;ev.preventDefault();ev.stopPropagation();open(b.dataset.vwrapped,b.closest('details.v36-notifications')?.querySelector('summary')||b);b.closest('details.v36-notifications')?.removeAttribute('open')},true);
 window.ViveWrapped={inbox,open};
})();
