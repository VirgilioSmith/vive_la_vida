/* VIVE · ViveUniversalNavigation — gesto universal de retroceso (Android/iOS) con arrastre interactivo.
   Un solo motor global (sin listeners por pantalla). Pointer Events + captura, rAF sólo durante el gesto, translate3d.
   No usa red ni almacenamiento remoto. Preparado para una futura integración nativa: el anfitrión (ViveNavHost) abstrae el router. */
(function(){
 'use strict';
 const C=window.ViveNavConfig;if(!C)return;
 const readPrefs=()=>{try{return Object.assign({},C.defaults,JSON.parse(localStorage.getItem(C.storageKey)||'{}'))}catch(_){return Object.assign({},C.defaults)}};
 let prefs=readPrefs();
 const P=()=>{const s=C.sensitivity[prefs.sensitivity]||{};return Object.assign({},C,s)};
 const reducedOS=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const animOn=()=>prefs.animations&&!prefs.reducedMotion&&!reducedOS();
 const BACK_SEL='[data-v243-explore-back],[data-v8-search-back],[data-v708="back"],.vwm-back,[data-act="back"],button[aria-label^="Volver"],button[aria-label^="Regresar"]';
 const NOSWIPE='input,textarea,select,[contenteditable=""],[contenteditable="true"],[data-no-swipe-back],input[type=range],[data-chart-tip],canvas';
 const vis=e=>{if(!e||!e.isConnected)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
 const host=()=>window.ViveNavHost||{isRoot:()=>true,pageBack:()=>false,canPageBack:()=>false};
 const surface=()=>{const m=document.querySelector('dialog.vmo[open]');return m||document.querySelector('#app main.main')||document.getElementById('page')};
 /* ── Capas: modal → Momentos → botón de regreso de la pantalla → historial interno ── */
 function topModalClose(){const m=document.getElementById('modal-root');if(!m||!m.children.length)return null;return [...m.querySelectorAll('[data-act="closeModal"],.fastx-close,[aria-label="Cerrar"]')].filter(vis).pop()||null}
 function dirty(root){for(const f of root.querySelectorAll('input,textarea,select')){if(f.type==='hidden'||f.disabled)continue;if(f.type==='checkbox'||f.type==='radio'){if(f.checked!==f.defaultChecked)return true}else if(f.tagName==='SELECT'){if([...f.options].some(o=>o.selected!==o.defaultSelected))return true}else if(String(f.value)!==String(f.defaultValue))return true}return false}
 function pageBackControl(){const root=document.getElementById('page')||document;return [...root.querySelectorAll(BACK_SEL)].filter(vis)[0]||null}
 /* Devuelve {kind,run} o null; kind 'blocked' si hay cambios sin guardar. */
 function plan(){
  if(window.ViveMomentos&&window.ViveMomentos.isOpen)return {kind:'momentos',run:()=>window.ViveMomentos.close()};
  const m=document.getElementById('modal-root');
  if(m&&m.children.length){const c=topModalClose();if(!c)return {kind:'blocked'};if(dirty(m))return {kind:'blocked'};return {kind:'modal',run:()=>c.click()}}
  const b=pageBackControl();if(b)return {kind:'control',run:()=>b.click()};
  const h=host();if(h.canPageBack&&h.canPageBack())return {kind:'history',run:()=>h.pageBack()};
  return null;
 }
 /* ── Estado del gesto ── */
 const G={on:false,id:null,side:null,x0:0,y0:0,t0:0,x:0,lastX:0,lastT:0,v:0,decided:false,locked:false,raf:0,el:null,ind:null,busy:false,plan:null};
 function ensureIndicator(){if(G.ind&&G.ind.isConnected)return G.ind;const d=document.createElement('div');d.className='vnav-ind';d.setAttribute('aria-hidden','true');d.innerHTML='<svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';document.body.appendChild(d);G.ind=d;return d}
 function startSide(e){const W=innerWidth,z=P().edgeZone;const sides=prefs.sides;if((sides==='both'||sides==='left')&&e.clientX<=z)return 'left';if((sides==='both'||sides==='right')&&e.clientX>=W-z)return 'right';return null}
 function scrollerBlocks(t,side){for(let n=t;n&&n!==document.body;n=n.parentElement){const s=getComputedStyle(n);if(!/(auto|scroll)/.test(s.overflowX)||n.scrollWidth<=n.clientWidth+1)continue;/* izquierda→derecha retrocede si no hay más contenido a la izquierda */if(side==='left'&&n.scrollLeft>1)return true;if(side==='right'&&n.scrollLeft+n.clientWidth<n.scrollWidth-1)return true}return false}
 function onDown(e){
  if(!prefs.enabled||G.on||G.busy)return;
  if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;           // PC/ratón: no se intercepta
  if(innerWidth>C.maxMobileWidth)return;
  if(e.button>0||!e.isPrimary)return;
  const side=startSide(e);if(!side)return;
  if(e.target.closest&&e.target.closest(NOSWIPE))return;
  if(scrollerBlocks(e.target,side))return;
  const pl=plan();if(!pl)return;
  Object.assign(G,{on:true,id:e.pointerId,side,x0:e.clientX,y0:e.clientY,t0:performance.now(),x:0,s:[[performance.now(),0]],lastX:e.clientX,lastT:performance.now(),v:0,decided:false,locked:false,el:surface(),plan:pl});
 }
 function frame(){G.raf=0;if(!G.locked||!G.el)return;const W=innerWidth,dx=Math.max(0,G.x);const k=Math.min(1,dx/W);
  G.el.style.transform=`translate3d(${G.side==='left'?dx:-dx}px,0,0)`;G.el.style.setProperty('--vnav-p',k.toFixed(3));
  const i=G.ind;if(i){i.style.setProperty('--vnav-o',Math.min(1,dx/90).toFixed(2));i.style.setProperty('--vnav-y',G.y0+'px');i.style.setProperty('--vnav-bulge',(Math.min(46,dx*.5)).toFixed(1)+'px')}}
 function request(){if(!G.raf)G.raf=requestAnimationFrame(frame)}
 function onMove(e){
  if(!G.on||e.pointerId!==G.id)return;
  const dxRaw=e.clientX-G.x0,dy=e.clientY-G.y0,dir=G.side==='left'?dxRaw:-dxRaw;
  if(!G.decided){
   const ax=Math.abs(dxRaw),ay=Math.abs(dy);
   if(Math.max(ax,ay)<P().intentDistance)return;
   if(dir>0&&ax>=ay*P().horizontalDominance){G.decided=true;G.locked=true;begin(e)}
   else{abort(false);return}   // vertical o hacia fuera: no es nuestro gesto
  }
  if(!G.locked)return;
  e.preventDefault&&e.cancelable&&e.preventDefault();
  const now=performance.now();(G.s=G.s||[]).push([now,dir]);while(G.s.length>2&&now-G.s[0][0]>100)G.s.shift();const a=G.s[0];G.v=now>a[0]?(dir-a[1])/(now-a[0]):0;
  G.lastX=e.clientX;G.lastT=now;G.x=Math.max(0,dir);request();
 }
 function begin(e){
  try{document.documentElement.setPointerCapture&&e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId)}catch(_){}
  document.documentElement.classList.add('vnav-dragging');
  if(G.el){G.el.style.willChange='transform';G.el.style.transition='none'}
  ensureIndicator().dataset.side=G.side;G.ind.style.display='block';
 }
 function cleanupVisual(){
  document.documentElement.classList.remove('vnav-dragging');
  if(G.el){G.el.style.transform='';G.el.style.transition='';G.el.style.willChange='';G.el.style.removeProperty('--vnav-p')}
  if(G.ind){G.ind.style.display='none';G.ind.style.setProperty('--vnav-o','0')}
 }
 function abort(){if(G.raf){cancelAnimationFrame(G.raf);G.raf=0}if(G.locked)cleanupVisual();G.on=false;G.locked=false;G.decided=false;G.id=null}
 function anim(el,from,to,ms,easing){return new Promise(res=>{if(!el.animate||!animOn()){res();return}const a=el.animate([{transform:from},{transform:to}],{duration:ms,easing,fill:'none'});a.onfinish=a.oncancel=()=>res()})}
 async function onUp(e){
  if(!G.on||e.pointerId!==G.id)return;
  if(!G.locked){abort();return}
  if(G.raf){cancelAnimationFrame(G.raf);G.raf=0}
  const W=innerWidth,dx=G.x,p=P(),el=G.el,side=G.side,pl=G.plan,v=G.v;
  const done=dx>=W*p.confirmRatio||(v>=p.confirmVelocity&&dx>=p.minFlingDistance);
  G.busy=true;G.on=false;
  const sgn=side==='left'?1:-1,cur=`translate3d(${sgn*dx}px,0,0)`;
  try{
   if(done){
    const fresh=plan();                            // el estado pudo cambiar durante el arrastre
    if(fresh&&fresh.kind!=='blocked'){
     const rest=Math.max(.35,1-dx/W);
     await anim(el,cur,`translate3d(${sgn*W}px,0,0)`,Math.round(p.commitMs*rest+80),'cubic-bezier(.2,.7,.2,1)');
     el.style.transition='none';el.style.transform='';
     fresh.run();                                   // un único retroceso, vía la lógica existente
     if(animOn()&&el.animate){requestAnimationFrame(()=>el.animate([{transform:`translate3d(${-sgn*W*.22}px,0,0)`,opacity:.55},{transform:'none',opacity:1}],{duration:p.commitMs,easing:'cubic-bezier(.2,.7,.2,1)'}))}
    }else await anim(el,cur,'translate3d(0,0,0)',p.cancelMs,'cubic-bezier(.3,1.25,.5,1)');
   }else await anim(el,cur,'translate3d(0,0,0)',p.cancelMs,'cubic-bezier(.3,1.25,.5,1)');
  }finally{cleanupVisual();G.locked=false;G.decided=false;G.id=null;G.busy=false}
 }
 function onCancel(e){if(G.on&&e.pointerId===G.id){const was=G.locked,x=G.x,el=G.el,side=G.side;G.on=false;if(was&&el&&el.animate&&animOn()){G.busy=true;anim(el,`translate3d(${(side==='left'?1:-1)*x}px,0,0)`,'translate3d(0,0,0)',200,'ease-out').finally(()=>{cleanupVisual();G.locked=false;G.busy=false})}else{cleanupVisual();G.locked=false}G.decided=false;G.id=null}}
 /* Mientras el gesto es nuestro, impedir que el navegador lo convierta en desplazamiento. */
 const onTouchMove=e=>{if(G.locked&&e.cancelable)e.preventDefault()};
 const L=[[document,'pointerdown',onDown,{passive:true,capture:true}],[document,'pointermove',onMove,{passive:false,capture:true}],[document,'pointerup',onUp,{capture:true}],[document,'pointercancel',onCancel,{capture:true}],[document,'touchmove',onTouchMove,{passive:false}]];
 function mount(){for(const [t,n,f,o] of L)t.addEventListener(n,f,o)}
 function unmount(){for(const [t,n,f,o] of L)t.removeEventListener(n,f,o);abort();if(G.ind){G.ind.remove();G.ind=null}}
 mount();
 /* Preferencias (Personalización → Navegación y gestos), delegadas una sola vez. */
 const onPref=e=>{const el=e.target.closest&&e.target.closest('[data-vnav-pref]');if(!el)return;const k=el.dataset.vnavPref;let v=el.type==='checkbox'?el.checked:el.value;prefs=Object.assign({},prefs,{[k]:v});try{localStorage.setItem(C.storageKey,JSON.stringify(prefs))}catch(_){}};
 document.addEventListener('change',onPref);
 window.ViveUniversalNavigation={prefs:()=>Object.assign({},prefs),setPrefs(o){prefs=Object.assign({},prefs,o);try{localStorage.setItem(C.storageKey,JSON.stringify(prefs))}catch(_){}},plan,unmount,get active(){return G.on||G.busy},config:C};
})();
