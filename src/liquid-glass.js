/* VIVE · LIQUID GLASS ENGINE — detección de capacidades, filtro de refracción y luz.
   · Sin red, sin Supabase, sin bucles: la luz solo se actualiza con el puntero/pulsación (un frame por evento, escribiendo dos
     variables CSS en UN elemento).
   · Refracción SVG (backdrop-filter:url(#…)) solo en Chromium; en Safari/Firefox se omite y el resto de capas queda completo. */
(()=>{
 'use strict';
 const root=document.documentElement,doc=document;
 const mq=q=>{try{return window.matchMedia&&matchMedia(q).matches}catch(_){return false}};
 /* ---- Capacidades ---- */
 const brands=(navigator.userAgentData&&navigator.userAgentData.brands||[]).map(b=>b.brand).join(' ');
 const isChromium=/Chromium|Google Chrome|Microsoft Edge/.test(brands)||(/Chrome\/\d+/.test(navigator.userAgent)&&!/Edg\/|OPR\//.test(navigator.userAgent)&&!/CriOS|FxiOS/.test(navigator.userAgent)&&!!window.chrome);
 const hasBF=!!(window.CSS&&(CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)')));
 const lite=(navigator.hardwareConcurrency||8)<=3||(navigator.deviceMemory||8)<=2||(navigator.connection&&navigator.connection.saveData===true);
 const caps={chromium:isChromium,backdrop:hasBF,lite,refract:false,reduceMotion:false,reduceTransparency:false};
 function evaluate(){
  caps.reduceMotion=mq('(prefers-reduced-motion:reduce)')||root.classList.contains('vg-reduce-motion');
  caps.reduceTransparency=mq('(prefers-reduced-transparency:reduce)')||root.classList.contains('vg-reduce-transparency');
  caps.refract=isChromium&&hasBF&&!lite&&!caps.reduceTransparency;
  root.classList.toggle('vlg-refract',caps.refract);
  root.classList.toggle('vlg-on',hasBF);
  root.classList.toggle('vlg-lite',lite);
 }
 /* ---- Filtro de refracción: lente en el borde (mapa de desplazamiento estirado al tamaño del elemento) ---- */
 const MAP="data:image/svg+xml;utf8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" preserveAspectRatio="none"><defs><linearGradient id="h" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ff0000"/><stop offset=".13" stop-color="#800000"/><stop offset=".87" stop-color="#800000"/><stop offset="1" stop-color="#000"/></linearGradient><linearGradient id="v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#00ff00"/><stop offset=".13" stop-color="#008000"/><stop offset=".87" stop-color="#008000"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="200" height="200" fill="url(#h)"/><rect width="200" height="200" fill="url(#v)" style="mix-blend-mode:screen"/></svg>');
 function mountDefs(){
  if(doc.getElementById('vlg-defs')||!doc.body)return;
  const s=doc.createElementNS('http://www.w3.org/2000/svg','svg');s.id='vlg-defs';s.setAttribute('width','0');s.setAttribute('height','0');s.setAttribute('aria-hidden','true');s.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML='<defs><filter id="vlg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="'+MAP+'" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="16" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
  doc.body.prepend(s);
  if(!doc.getElementById('vlg-aura')){const a=doc.createElement('div');a.id='vlg-aura';a.setAttribute('aria-hidden','true');doc.body.prepend(a)}
 }
 /* ---- Qué superficies llevan el material ----
    Una sola lista por tipo. JS marca con data-vlg solo los elementos cuyo ::before y ::after están libres (si un componente ya los usa,
    se respeta y no se toca). El CSS solo conoce [data-vlg]. */
 const FLOAT='.vive-mobile-dock,.v708-movements-fab,.v249-register-fab,.sidebar.rail-sidebar';
 const CTRL='.v165-search-icon,.v990-month,.vxm-period,.v911-month,.v36-notifications>summary,.v402-sync';
 const SHEET='.modal.vsheet';
 const TILES='.vBanks-mobile-tiles>button,.vBanksPc-overview-tile';
 const PANEL='.vWalletPc-panel,.vBanksPc-metric,.vBanksPc-overview,.vBanksPc-bank-list,.vBanksPc-institution,.v134-panel,.vPatrimony-position-part,.v1170-panel,.v1170-card,.v1170-kpi,.v1170-hero,.v1170-bcard,.vexp-panel,.vinc-kpi,.v1200-kpi,.v1200-hero,.ff-tile,.ff-bubble,.v421-net,.v421-meter,.v421-mini-card,.v105-capacity-widget,.vive-mobile-commitments,.v89-debt-breakdown,.v344-creative,.vBanks-mobile-hero,.vBanks-mobile-products,.vBanks-mobile-return';
 const ALL=[FLOAT,CTRL,SHEET,TILES,PANEL].join(',');
 const free=c=>c==='none'||c==='normal'||c==='';
 function markOne(el){
  if(el.hasAttribute('data-vlg')||el.hasAttribute('data-vlg-skip'))return;
  const cs1=getComputedStyle(el,'::before').content,cs2=getComputedStyle(el,'::after').content;
  if(!free(cs2)){el.setAttribute('data-vlg-skip','1');return}
  const aft=!free(cs1);
  const kind=el.matches(FLOAT)||el.matches(CTRL)?'refract press':el.matches(SHEET)?'sheet':el.matches(TILES)?'panel press':'panel';
  el.setAttribute('data-vlg',kind+(aft?' aft':''));
  /* Si otra regla fuerza content:none en el pseudo-elemento, las capas no se pintan: el componente conserva solo la refracción/pulsación */
  if(getComputedStyle(el,'::after').content!=='""')el.setAttribute('data-vlg',kind+' bare');
 }
 function mark(scope){
  try{if(scope.nodeType===1&&scope.matches(ALL))markOne(scope);scope.querySelectorAll(ALL).forEach(markOne)}catch(_){}
 }
 let pend=new Set(),mraf=0;
 function flush(){mraf=0;const s=pend;pend=new Set();s.forEach(n=>{if(n.isConnected)mark(n)})}
 function observe(){
  mark(doc.body);
  new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)pend.add(n);if(pend.size&&!mraf)mraf=requestAnimationFrame(flush)}).observe(doc.body,{childList:true,subtree:true});
 }
 /* ---- Luz: sigue al puntero sobre la superficie (un solo elemento, un frame) ---- */
 const SURF='[data-vlg]';
 let raf=0,ev=null,lit=null;
 function paint(){
  raf=0;if(!ev)return;const e=ev;ev=null;
  const el=e.target&&e.target.closest?e.target.closest(SURF):null;
  if(lit&&lit!==el){lit.style.removeProperty('--vlg-lx');lit.style.removeProperty('--vlg-ly');lit=null}
  if(!el)return;
  const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
  const x=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y=Math.max(-10,Math.min(100,(e.clientY-r.top)/r.height*100));
  el.style.setProperty('--vlg-lx',x.toFixed(1)+'%');el.style.setProperty('--vlg-ly',y.toFixed(1)+'%');lit=el;
 }
 function onMove(e){if(caps.reduceMotion||caps.lite)return;ev=e;if(!raf)raf=requestAnimationFrame(paint)}
 function onLeave(){if(lit){lit.style.removeProperty('--vlg-lx');lit.style.removeProperty('--vlg-ly');lit=null}}
 function boot(){
  evaluate();mountDefs();observe();
  doc.addEventListener('pointermove',onMove,{passive:true});
  doc.addEventListener('pointerdown',onMove,{passive:true});
  doc.addEventListener('pointerup',()=>setTimeout(onLeave,380),{passive:true});
  doc.addEventListener('pointerleave',onLeave,{passive:true});
  doc.addEventListener('vive:glass',evaluate);
  try{matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',evaluate);matchMedia('(prefers-reduced-transparency:reduce)').addEventListener('change',evaluate)}catch(_){}
  new MutationObserver(evaluate).observe(root,{attributes:true,attributeFilter:['class']});   /* tema / preferencias de Glass Engine */
 }
 window.ViveLiquidGlass=Object.freeze({caps:()=>({...caps}),refresh:evaluate,mark:()=>mark(doc.body),surfaces:()=>[...doc.querySelectorAll('[data-vlg]')].length});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);else boot();
})();
