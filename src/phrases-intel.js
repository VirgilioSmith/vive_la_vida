/* VIVE · inteligencia de Frases — memoria y deduplicación léxico-semántica (local, determinista, sin red ni IA generativa).
   No genera frases ni las relaciona con el dinero: solo ayuda a que el banco existente no se repita (ni con otras palabras)
   y a variar longitud, tema y ritmo. Aproximación declarada: similitud por raíces + familias de conceptos (no hay embeddings). */
(function(root){
 'use strict';
 const STOP=new Set('el la los las un una unos unas de del al y o u e en a con por para que se su sus tu tus mi mis lo le les es son ser esta este estos estas como mas pero si no ya hay'.split(' '));
 /* familias de conceptos: raíces que expresan la misma idea (para detectar repetición «con otras palabras») */
 const CONCEPTS={ahorro:['ahorr','guard','colchon','reserv'],vivir:['viv','vida'],hoy:['hoy','present','ahora'],tiempo:['tiemp','hora','dia'],gratitud:['grac','agradec','gratitud','agradec'],familia:['famil','padre','madre','abuel','hermano','hijo'],dios:['dios','fe','orar','oracion','esperanz'],joseo:['jose','vuelt','hambre','movida','facturar','resolv'],libertad:['libre','libert','elegir','depend'],crecer:['crec','aprend','avanz','progres','paso'],paz:['paz','calma','tranquil','seren','descans'],salud:['salud','cuerp','cuid']};
 const strip=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 function tokens(text){return strip(String(text)).replace(/[^a-z0-9ñ\s]/g,' ').split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)).map(w=>w.replace(/(mente|ando|iendo|ar|er|ir|es|s)$/,''))}
 function conceptsOf(toks){const out=new Set();for(const [c,roots] of Object.entries(CONCEPTS))if(toks.some(w=>roots.some(r=>w.startsWith(r))))out.add(c);return out}
 const jac=(a,b)=>{if(!a.size||!b.size)return 0;let i=0;for(const x of a)if(b.has(x))i++;return i/(a.size+b.size-i)};
 const cont=(a,b)=>{if(!a.size||!b.size)return 0;let i=0;for(const x of a)if(b.has(x))i++;return i/Math.min(a.size,b.size)};
 const cache=new Map();
 function sig(text){let s=cache.get(text);if(!s){const t=tokens(text);s={set:new Set(t),con:conceptsOf(t),n:t.length};if(cache.size>2000)cache.clear();cache.set(text,s)}return s}
 /* 0–1. Léxica (raíces) y conceptual (familias); la conceptual solo cuenta si comparten ≥2 conceptos */
 function similarity(a,b){const A=sig(a),B=sig(b);if(a===b)return 1;const lex=Math.max(jac(A.set,B.set),A.n>=4&&B.n>=4?.9*cont(A.set,B.set):0);
  const shared=[...A.con].filter(x=>B.con.has(x)).length;const con=shared>=2?Math.min(.65,.25+.2*shared)*jac(A.con,B.con):0;return Math.min(1,Math.max(lex,con))}
 const lenClass=t=>t.length<55?'s':t.length<110?'m':'l';
 /* ¿Es aceptable mostrar `text` dada la memoria reciente? (distancia semántica, tema y ritmo de longitud) */
 function ok(text,theme,recent,o={}){const win=o.window||12,thr=o.threshold||.6;const r=(recent||[]).slice(-win);
  for(const x of (recent||[]).slice(-(o.exactWindow||60)))if(x.t===text)return {ok:false,why:'ya mostrada hace poco'};
  for(const x of r)if(similarity(text,x.t)>=thr)return {ok:false,why:'similar a una reciente'};
  const l3=r.slice(-3);if(theme&&l3.length===3&&l3.every(x=>x.th===theme))return {ok:false,why:'mismo tema 3 veces'};
  const lc=lenClass(text);if(l3.length===3&&l3.every(x=>lenClass(x.t)===lc))return {ok:false,why:'mismo ritmo de longitud'};return {ok:true}}
 function remember(recent,text,theme,today,cap=60){const r=(recent||[]).concat([{t:text,th:theme||'',d:today||''}]);return r.slice(-cap)}
 /* Auditoría del banco: pares casi idénticos (para limpiar contenido, no para borrarlo automáticamente) */
 function audit(bank,thr=.75){const items=[];for(const [th,list] of Object.entries(bank))for(const t of list)items.push({t,th});const near=[];
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const s=similarity(items[i].t,items[j].t);if(s>=thr)near.push({a:items[i].t,b:items[j].t,themes:[items[i].th,items[j].th],sim:+s.toFixed(2)})}
  const themes={};for(const x of items)themes[x.th]=(themes[x.th]||0)+1;return {total:items.length,themes,near,exact:near.filter(n=>n.sim===1).length}}
 /* Diversidad reciente: temas distintos y repetición media (sin puntuaciones ficticias) */
 function diversity(recent){const r=(recent||[]).slice(-16);if(r.length<4)return null;let s=0,n=0;for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){s+=similarity(r[i].t,r[j].t);n++}
  return {n:r.length,temas:new Set(r.map(x=>x.th)).size,similitudMedia:+(s/n).toFixed(2),longitudes:{cortas:r.filter(x=>lenClass(x.t)==='s').length,medias:r.filter(x=>lenClass(x.t)==='m').length,largas:r.filter(x=>lenClass(x.t)==='l').length}}}
 const api={similarity,ok,remember,audit,diversity,tokens,conceptsOf,lenClass};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.VivePhrases=api;
})(typeof window!=='undefined'?window:globalThis);
