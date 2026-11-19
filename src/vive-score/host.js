/* VIVE SCORE CRÉDITO · anfitrión (solo escritorio, experimental).
   - Lleva la cuenta del número del ítem «Score» en la barra lateral.
   - Monta la página dentro de un iframe aislado (src/vive-score/frame.html) que mantiene su propio estado.
   - Entrega los datos de solo lectura (adapter.js) y guarda la persistencia experimental separada
     en localStorage bajo la clave «vive-score:v1». Nada de esto toca las tablas ni los registros existentes. */
(function(){
'use strict';
if(!window.VIVE_SCORE_EXPERIMENTAL)return;
const KEY='vive-score:v1',FRAME_SRC='./src/vive-score/frame.html?v=24';
const newStore=()=>({v:1,startedOn:'2026-11',answers:null,overrides:{},observed:{},settings:null,audit:[],seals:[],declVersion:0,lastScore:null,lastPeriod:null});
let store=null,frame=null,ready=false,height=Math.max(560,innerHeight-170),payloadSent=false;
function load(){if(store)return store;try{const x=JSON.parse(localStorage.getItem(KEY)||'null');store=x&&x.v===1?{...newStore(),...x}:newStore()}catch(_){store=newStore()}return store}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){console.warn('VIVE SCORE: no se pudo guardar',e)}}
const mobile=()=>window.innerWidth<=790;
function env(){
 const cs=getComputedStyle(document.body),body=document.body.classList;
 const accent=(cs.getPropertyValue('--v424-accent-strong')||'').trim()||'#159b81';
 const mode=body.contains('theme-black')?'black':body.contains('theme-dark')?'dark':'light';
 const root=getComputedStyle(document.documentElement),nav={};for(const k of ['shell-alpha','shell-border-alpha','shell-shadow-alpha','shell-blur'])nav[k]=(root.getPropertyValue('--v443-nav-'+k)||'').trim();
 return {mode,accent,compact:mobile(),nav};
}
function post(type,data){try{frame?.contentWindow?.postMessage({vs:1,type,...data},location.origin)}catch(_){}}
let lastSig='',pollTimer=0,refreshTimer=0;
function sendInit(){const p=window.ViveScoreAdapter?.read();lastSig=JSON.stringify(p||null);post('init',{payload:p,store:load(),env:env()});payloadSent=true;/* se muestra solo con el tema y el acento ya aplicados (sin destello verde de arranque) */setTimeout(()=>{if(frame)frame.style.opacity='1'},160)}
/* Alimentación automática: lee (solo lectura, en memoria) los datos de la app y avisa al módulo únicamente si cambiaron. No hay consultas a Supabase. */
function refreshIfChanged(){if(!frame||!ready||!frame.classList.contains('vs-on'))return;const p=window.ViveScoreAdapter?.read(),sig=JSON.stringify(p||null);if(sig===lastSig)return;lastSig=sig;post('data',{payload:p})}
const queueRefresh=()=>{if(refreshTimer)return;refreshTimer=setTimeout(()=>{refreshTimer=0;refreshIfChanged()},350)};
window.addEventListener('focus',queueRefresh);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')queueRefresh()});
setInterval(()=>{if(document.visibilityState==='visible'&&frame?.classList.contains('vs-on'))refreshIfChanged()},5000);
function ensureFrame(){
 if(frame)return frame;
 frame=document.createElement('iframe');frame.className='vs-frame';frame.title='VIVE SCORE CRÉDITO';frame.setAttribute('aria-label','VIVE SCORE CRÉDITO');
 frame.style.opacity='0';frame.style.transition='opacity .15s';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox');frame.src=FRAME_SRC;document.body.appendChild(frame);return frame;
}
function slot(){return document.querySelector('[data-vs-slot]')}
function place(){
 const s=slot();
 if(!s){frame?.classList.remove('vs-on');return}
 ensureFrame();
 const r=s.getBoundingClientRect();
 height=Math.max(mobile()?440:560,Math.round(innerHeight-r.top-(mobile()?96:14)));
 Object.assign(frame.style,{left:(r.left+scrollX)+'px',top:(r.top+scrollY)+'px',width:r.width+'px',height:height+'px'});
 s.style.height=height+'px';
 if(!frame.classList.contains('vs-on')){frame.classList.add('vs-on');if(ready)sendInit()}
}
/* Ocultar el marco es inmediato (sin esperar un cuadro) y el ciclo pendiente no se cancela: en vistas que cambian el DOM sin parar (p. ej. Resumen)
   un debounce con cancelAnimationFrame nunca llegaba a ejecutarse y el marco se quedaba flotando sobre todas las vistas. */
let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;place();queueRefresh()})};
new MutationObserver(()=>{if(frame&&frame.classList.contains('vs-on')&&!slot())frame.classList.remove('vs-on');schedule()}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize',schedule);
new MutationObserver(()=>post('env',{env:env()})).observe(document.body,{attributes:true,attributeFilter:['class','style']});
new MutationObserver(()=>post('env',{env:env()})).observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||!frame||e.source!==frame.contentWindow)return;const m=e.data;if(!m||m.vs!==1)return;
 if(m.type==='ready'){ready=true;if(slot())sendInit();}
 else if(m.type==='save'&&m.store&&m.store.v===1){store={...newStore(),...m.store};persist()}
 else if(m.type==='refreshRequest'){sendInit()}
 else if(m.type==='score'){load();store.lastScore=Number.isFinite(m.score)?m.score:null;store.lastPeriod=m.period||null;persist();document.querySelectorAll('.vive-score-badge').forEach(b=>b.textContent=store.lastScore??'—')}
 else if(m.type==='go'&&typeof m.page==='string'&&/^[a-z]+$/.test(m.page)){window.__viveScoreBridge?.go(m.page)}
});
window.ViveScoreHost=Object.freeze({
 badge:()=>{const v=load().lastScore;return Number.isFinite(v)?v:'—'},
 pageHtml:()=>'<section class="vs-slot" data-vs-slot aria-label="VIVE SCORE CRÉDITO" style="height:'+height+'px"></section>',
 /* Reversión de datos: borra SOLO la persistencia experimental. */
 reset:()=>{store=newStore();try{localStorage.removeItem(KEY)}catch(_){}post('init',{payload:window.ViveScoreAdapter?.read(),store,env:env()})}
});
})();
