/* VIVE · GLASS ENGINE — controlador de preferencias.
   · No consulta ni escribe en Supabase: solo aplica variables CSS sobre <html>.
   · El guardado persistente lo hace app.js reutilizando db.settings + persist() al SOLTAR un control;
     este módulo además guarda una copia local (localStorage) para evitar parpadeo al arrancar.
   · La luz bajo el cursor solo escribe dos variables CSS en el elemento bajo el puntero (rAF), sin tocar el DOM. */
(()=>{
 'use strict';
 const KEY='vive.glass.prefs.v1';
 const DEFAULTS=Object.freeze({intensity:100,accent:100,light:100,reduceTransparency:false,reduceMotion:false});
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const num=(v,d)=>{const n=Number(v);return Number.isFinite(n)?n:d};
 const norm=p=>{p=p||{};return{
  intensity:clamp(Math.round(num(p.intensity,DEFAULTS.intensity)),0,160),
  accent:clamp(Math.round(num(p.accent,DEFAULTS.accent)),0,160),
  light:clamp(Math.round(num(p.light,DEFAULTS.light)),0,160),
  reduceTransparency:p.reduceTransparency===true,
  reduceMotion:p.reduceMotion===true};};
 let current=norm(DEFAULTS);
 const root=document.documentElement;
 function apply(p){
  current=norm(p);
  const s=root.style;
  s.setProperty('--vg-k',(current.intensity/100).toFixed(3));
  s.setProperty('--vg-ak',(current.accent/100).toFixed(3));
  s.setProperty('--vg-lk',(current.light/100).toFixed(3));
  root.classList.toggle('vg-reduce-transparency',current.reduceTransparency);
  root.classList.toggle('vg-reduce-motion',current.reduceMotion);
  try{localStorage.setItem(KEY,JSON.stringify(current))}catch(_){}
  try{document.dispatchEvent(new CustomEvent('vive:glass',{detail:{...current}}))}catch(_){}
  return {...current};
 }
 function restore(){return apply(DEFAULTS)}
 function get(){return {...current}}
 function boot(){try{const raw=localStorage.getItem(KEY);if(raw)apply(JSON.parse(raw))}catch(_){}}
 boot();

 /* Luz sutil bajo el cursor (solo escritorio, sin tocar el DOM) */
 if(window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches){
  let raf=0,last=null,ev=null;
  const sel='.vg-button,.vg-icon-button,.vg-segmented>*,.is-interactive';
  document.addEventListener('pointermove',e=>{ev=e;if(raf)return;raf=requestAnimationFrame(()=>{
   raf=0;const t=ev&&ev.target&&ev.target.closest&&ev.target.closest(sel);
   if(!t){last=null;return}
   const r=t.getBoundingClientRect();
   t.style.setProperty('--vg-px',((ev.clientX-r.left)/Math.max(1,r.width)*100).toFixed(1)+'%');
   t.style.setProperty('--vg-py',((ev.clientY-r.top)/Math.max(1,r.height)*100).toFixed(1)+'%');
   last=t;});},{passive:true});
 }

 window.ViveGlass=Object.freeze({apply,restore,get,DEFAULTS,levels:['00 base','01 cristal ambiental','02 cristal estructural','03 cristal interactivo','04 cristal flotante','05 cristal prioritario']});
})();
