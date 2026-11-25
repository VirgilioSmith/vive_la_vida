/* VIVE · Momentos — interfaz inmersiva (cápsula → pantalla completa). Todo local: sin red, sin Realtime, sin sondeos.
   Requiere window.ViveMomentosEngine y window.ViveMomentosHost = {snapshot(), go(id), icon(nombre)} (lo registra app.js). */
(function(){
 'use strict';
 const E=window.ViveMomentosEngine;if(!E)return;
 const K_FAV='vive.momentos.fav.v1',K_RECENT='vive.momentos.recent.v1',K_MODE='vive.momentos.mode.v1';
 const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(_){return d}};
 const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
 const host=()=>window.ViveMomentosHost||{snapshot:()=>({verified:false}),go(){},icon:()=>''};
 const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const day=()=>new Date().toISOString().slice(0,10);
 const S={fav:new Set(read(K_FAV,[])),recent:read(K_RECENT,[]),mode:read(K_MODE,'all'),pb:E.createPlayback(),dlg:null,opener:null,raf:0,last:0,closing:false,popped:false,ignorePop:0};
 if(!E.MODES.some(m=>m[0]===S.mode))S.mode='all';
 const $=q=>S.dlg.querySelector(q);
 const fmt=s=>`0:${String(Math.floor(s)).padStart(2,'0')}`;
 const opts=()=>({recent:S.recent,favorites:S.fav,seed:day()});
 /* Momento destacado para la cápsula del dock (usa el mismo motor, sin abrir nada). */
 function top(){const q=E.build(host().snapshot(),'all',opts());const m=q[0]||E.EMPTY;return {title:m.title,theme:m.theme,icon:E.THEMES[m.theme][4],critical:!!m.critical,tone:m.theme==='red'?'alert':m.theme==='amber'?'warn':m.theme==='growth'?'good':'calm'}}
 const SVG={prev:'<path d="M6 5v14M19 5 9 12l10 7z" fill="currentColor"/>',next:'<path d="M18 5v14M5 5l10 7-10 7z" fill="currentColor"/>',play:'<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',pause:'<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',down:'<path d="m5 9 7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',queue:'<path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'};
 const ico=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${SVG[n]}</svg>`;
 function build(){
  const d=document.createElement('dialog');d.className='vmo';d.setAttribute('aria-labelledby','vmoTitle');
  d.innerHTML=`<div class="vmo-inner" tabindex="-1">
  <div class="vmo-art" id="vmoArt"><img id="vmoImg" alt="" hidden decoding="async"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path id="vmoSymbol" d=""/></svg><span class="vmo-art-fade" aria-hidden="true"></span></div>
  <div class="vmo-grab"><button type="button" class="vmo-drag" data-vmo="close" aria-label="Minimizar Momentos"><span class="vmo-handle"></span></button></div>
  <button type="button" class="vmo-ic vmo-x" data-vmo="close" aria-label="Cerrar Momentos">${ico('down')}</button>
  <div class="vmo-sheet">
  <div class="vmo-line vmo-head"><div><div class="vmo-cat" id="vmoCat"></div><h2 id="vmoTitle"></h2></div><button type="button" class="vmo-ic vmo-fav" data-vmo="fav" aria-label="Guardar en favoritos" aria-pressed="false">${ico('star')}</button></div>
  <p id="vmoText" aria-live="polite"></p>
  <input class="vmo-progress" id="vmoProg" type="range" min="0" max="100" step="1" value="0" aria-label="Progreso del momento">
  <div class="vmo-line vmo-meta"><small id="vmoEl">0:00</small><small id="vmoCount"></small><small id="vmoDur"></small></div>
  <div class="vmo-controls"><button type="button" class="vmo-ic" data-vmo="prev" aria-label="Momento anterior">${ico('prev')}</button><button type="button" class="vmo-play" data-vmo="play" aria-label="Reproducir">${ico('play')}</button><button type="button" class="vmo-ic" data-vmo="next" aria-label="Momento siguiente">${ico('next')}</button></div>
  <button type="button" class="vmo-action" data-vmo="action" hidden></button>
  <div class="vmo-foot"><select id="vmoMode" aria-label="Modo de reproducción">${E.MODES.map(m=>`<option value="${m[0]}">${m[1]}</option>`).join('')}</select><button type="button" class="vmo-qbtn" data-vmo="queue" aria-expanded="false">${ico('queue')}<span>Cola</span></button></div>
  <div class="vmo-queue" id="vmoQueue" hidden></div></div></div>`;
  document.body.appendChild(d);S.dlg=d;
  /* Listeners registrados UNA sola vez al crear el diálogo (abrir/cerrar no los acumula). */
  d.addEventListener('click',onClick);
  d.addEventListener('cancel',e=>{e.preventDefault();close()});
  d.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();step(1)}else if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}});
  $('#vmoProg').addEventListener('input',e=>{S.pb.seek(Number(e.target.value)/100);paint()});
  $('#vmoMode').addEventListener('change',e=>{S.mode=e.target.value;save(K_MODE,S.mode);refresh(false);if(S.pb.state.playing)startLoop()});
  let y0=null;const g=$('.vmo-grab');
  g.addEventListener('pointerdown',e=>{y0=e.clientY;try{g.setPointerCapture(e.pointerId)}catch(_){}});
  g.addEventListener('pointerup',e=>{if(y0!==null&&e.clientY-y0>45){e.preventDefault();close()}y0=null});
  g.addEventListener('pointercancel',()=>{y0=null});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&S.pb.state.playing){stopLoop(true)}paintState()});
  window.addEventListener('popstate',()=>{if(S.ignorePop>0){S.ignorePop--;return}if(S.dlg&&S.dlg.open){S.popped=true;close()}});
 }
 function onClick(e){
  const b=e.target.closest('[data-vmo]');
  if(b){
   const a=b.dataset.vmo;
   if(a==='close')close();else if(a==='play')toggle();else if(a==='next')step(1);else if(a==='prev')step(-1);else if(a==='fav')fav();
   else if(a==='queue'){const q=$('#vmoQueue'),on=q.hidden;q.hidden=!on;b.setAttribute('aria-expanded',String(on))}
   else if(a==='action'){const m=S.pb.current();if(m.action){const go=m.action.go;close().then(()=>host().go(go))}}
   return;
  }
  const q=e.target.closest('[data-vmo-i]');if(q){go(Number(q.dataset.vmoI))}
 }
 function recent(id){if(!E.PHRASES.some(p=>p.id===id))return;S.recent=[id,...S.recent.filter(x=>x!==id)].slice(0,8);save(K_RECENT,S.recent)}
 function go(i){S.pb.go(i);recent(S.pb.current().id);render(true);if(S.pb.state.playing)startLoop()}
 function step(n){go(S.pb.state.idx+n)}
 function fav(){const id=S.pb.current().id;if(id==='empty')return;S.fav.has(id)?S.fav.delete(id):S.fav.add(id);save(K_FAV,[...S.fav]);if(S.mode==='favorites')refresh(true);else paintFav()}
 function refresh(keep){S.pb.setQueue(E.build(host().snapshot(),S.mode,opts()),keep);render(false)}
 function paintFav(){const id=S.pb.current().id,on=S.fav.has(id),f=$('.vmo-fav');f.setAttribute('aria-pressed',String(on));f.classList.toggle('on',on);f.disabled=id==='empty'}
 function render(animate){
  const m=S.pb.current(),t=E.THEMES[m.theme]||E.THEMES.calm,st=S.dlg.style;
  st.setProperty('--vmo-a',t[0]);st.setProperty('--vmo-b',t[1]);st.setProperty('--vmo-c',t[2]);
  $('#vmoSymbol').setAttribute('d',t[3]);const im=$('#vmoImg');if(t[5]){if(im.getAttribute('src')!==t[5])im.setAttribute('src',t[5]);im.hidden=false}else im.hidden=true;S.dlg.classList.toggle('vmo-has-img',!!t[5]);themeColor(t[6]||t[1]);
  $('#vmoCat').textContent=E.LABELS[m.mode]||'VIVE';$('#vmoTitle').textContent=m.title;$('#vmoText').textContent=m.text;
  $('#vmoCount').textContent=S.pb.state.queue.length?`${S.pb.state.idx+1} de ${S.pb.state.queue.length}`:'0 momentos';
  $('#vmoDur').textContent=m.hold?'Manual':fmt(m.seconds);
  const act=$('.vmo-action');act.hidden=!m.action;act.textContent=m.action?m.action.label:'';
  const mode=$('#vmoMode');if(mode.value!==S.mode)mode.value=S.mode;
  const q=$('#vmoQueue');q.replaceChildren(...S.pb.state.queue.map((x,i)=>{const bt=document.createElement('button');bt.type='button';bt.dataset.vmoI=i;bt.textContent=`${i+1}. ${x.title}`;bt.setAttribute('aria-current',String(i===S.pb.state.idx));return bt}));
  paintFav();paint();
  if(animate&&!reduced()&&$('#vmoTitle').animate){$('.vmo-sheet').animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:280,easing:'ease-out'});$('#vmoArt').animate([{opacity:.4,transform:'scale(.97)'},{opacity:1,transform:'none'}],{duration:500,easing:'ease-out'})}
 }
 function paint(){
  const m=S.pb.current(),s=S.pb.state;
  $('#vmoProg').value=Math.min(100,s.elapsed/m.seconds*100);$('#vmoEl').textContent=fmt(s.elapsed);paintState();
 }
 function paintState(){
  if(!S.dlg)return;const p=S.pb.state.playing;
  const pl=$('.vmo-play');pl.innerHTML=ico(p?'pause':'play');pl.setAttribute('aria-label',p?'Pausar':'Reproducir');
  S.dlg.classList.toggle('vmo-paused',!p||document.hidden||!S.dlg.open);
 }
 function loop(t){
  if(!S.pb.state.playing||!S.dlg.open||document.hidden){stopLoop();return}
  const dt=S.last?(t-S.last)/1000:0;S.last=t;
  const r=S.pb.tick(dt);
  if(r==='advanced'){recent(S.pb.current().id);render(true)}else if(r==='ended'||r==='held'){paint();stopLoop();return}else paint();
  S.raf=requestAnimationFrame(loop);
 }
 function startLoop(){cancelAnimationFrame(S.raf);S.last=0;S.raf=requestAnimationFrame(loop)}
 function stopLoop(pause){cancelAnimationFrame(S.raf);S.raf=0;S.last=0;if(pause)S.pb.pause();paintState()}
 function toggle(){if(S.pb.state.playing){S.pb.pause();stopLoop()}else{S.pb.play();paintState();startLoop()}}
 /* La barra de estado del iPhone toma el color superior de la portada (y se restaura al cerrar). */
 let tcMeta=null,tcOrig=null;
 function themeColor(c){try{tcMeta=tcMeta||document.querySelector('meta[name=theme-color]');if(!tcMeta)return;if(tcOrig===null)tcOrig=tcMeta.getAttribute('content');if(S.dlg&&S.dlg.open)tcMeta.setAttribute('content',c)}catch(_){}}
 function themeColorRestore(){try{if(tcMeta&&tcOrig!==null){tcMeta.setAttribute('content',tcOrig);tcOrig=null}}catch(_){}}
 const T=(r,p)=>`translate(${r.left-p.left}px,${r.top-p.top}px) scale(${r.width/p.width},${r.height/p.height})`;
 function open(opener){
  if(S.closing||(S.dlg&&S.dlg.open))return;
  if(!S.dlg)build();
  S.opener=opener||document.querySelector('.vive-mobile-dock-center');
  const r=S.opener&&S.opener.getBoundingClientRect();
  refresh(false);recent(S.pb.current().id);
  S.dlg.showModal();S.dlg.classList.remove('vmo-closing');{const q=E.THEMES[S.pb.current().theme]||E.THEMES.calm;themeColor(q[6]||q[1])}
  try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}
  try{history.pushState({vmo:1},'');S.popped=false}catch(_){}
  if(r&&r.width&&!reduced()&&S.dlg.animate){const p=S.dlg.getBoundingClientRect();
   S.dlg.animate([{transform:T(r,p),opacity:.5,borderRadius:'40px'},{transform:'none',opacity:1,borderRadius:'28px'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});
   $('.vmo-sheet').animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:360,delay:120,fill:'backwards'})}
  S.pb.play();paintState();startLoop();
  $('.vmo-inner').focus({preventScroll:true});
 }
 async function close(){
  if(!S.dlg||!S.dlg.open||S.closing)return;
  S.closing=true;S.pb.pause();stopLoop();
  const r=S.opener&&S.opener.isConnected?S.opener.getBoundingClientRect():null;
  if(r&&r.width&&!reduced()&&S.dlg.animate){try{await S.dlg.animate([{transform:'none',opacity:1},{transform:T(r,S.dlg.getBoundingClientRect()),opacity:.25}],{duration:330,easing:'ease-in',fill:'forwards'}).finished}catch(_){}}
  S.dlg.getAnimations().forEach(a=>a.cancel());S.dlg.close();S.closing=false;themeColorRestore();paintState();
  if(!S.popped&&history.state&&history.state.vmo){S.ignorePop++;try{history.back()}catch(_){S.ignorePop--}}
  S.popped=false;
  if(S.opener&&S.opener.isConnected)try{S.opener.focus({preventScroll:true})}catch(_){}
 }
 /* Apertura desde la cápsula del dock (delegado, una sola vez). */
 document.addEventListener('click',e=>{const o=e.target.closest&&e.target.closest('[data-momentos-open]');if(o){e.preventDefault();e.stopImmediatePropagation();open(o)}},true);
 window.ViveMomentos={open,close,top,state:S,engine:E,get isOpen(){return !!(S.dlg&&S.dlg.open)}};
})();
