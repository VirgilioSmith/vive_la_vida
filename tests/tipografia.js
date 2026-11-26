'use strict';
/* Fase 04 · Tipografía: por ruta (PC/móvil × Claro/Black) mide pesos distintos, textos < 12 px, importes (RD$/US$) recortados o sin cifras tabulares.
   Informe test-results/auditoria/fase04/<OUT>. */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');const open=require('./harness');
const PAGES=['overview','register','flow','income','expenses','wallet','banks','accounts','cards','loans','certificates','mobilehub','budget','categories','recurring','personal','patrimony','advanced','settings','mobilesearch'];
const P=()=>{
 const vis=e=>{const b=e.getBoundingClientRect();if(b.width<2||b.height<2)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>.05};
 const own=e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
 const els=[...document.querySelectorAll('#app *')].filter(e=>vis(e)&&own(e));
 const weights={};const tiny=[];const money=[];const MONEY=/(RD\$|US\$)\s?[-−+]?\s?\d/;
 for(const e of els){const s=getComputedStyle(e);const fs=parseFloat(s.fontSize);weights[s.fontWeight]=(weights[s.fontWeight]||0)+1;
  if(fs<12)tiny.push(e.tagName.toLowerCase()+'.'+String(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className).split(' ')[0]+' '+fs+'px «'+e.textContent.trim().slice(0,14)+'»');
  if(MONEY.test(e.textContent)&&e.children.length===0){const clipped=e.scrollWidth>e.clientWidth+1||(s.textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth);
   money.push({fs,clipped,tab:/tabular/.test(s.fontVariantNumeric),w:s.fontWeight,t:e.textContent.trim().slice(0,22),c:e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0]})}}
 return {pesos:Object.keys(weights).sort(),nPesos:Object.keys(weights).length,tiny:tiny.length,tinyEj:tiny.slice(0,4),importes:money.length,recortados:money.filter(m=>m.clipped).length,recortadosEj:money.filter(m=>m.clipped).slice(0,3),
  sinTabular:money.filter(m=>!m.tab).length,minImporte:money.length?Math.min(...money.map(m=>m.fs)):null,pesados:Object.entries(weights).filter(([w])=>+w>=800).reduce((a,[,n])=>a+n,0)}};
(async()=>{
 const b=await chromium.launch(),res={};
 for(const [w,h,pl] of [[1440,900,'pc'],[390,844,'movil'],[820,1180,'tablet']])for(const theme of ['light','black']){
  process.env.THEME=theme;if(w<800)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);const k=pl+'-'+theme;res[k]={};
  for(const pg of PAGES){try{await p.evaluate(id=>window.__T.go(id),pg);await p.waitForTimeout(400);res[k][pg]=await p.evaluate(P)}catch(e){res[k][pg]={error:1}}}
  await ctx.close()}
 await b.close();fs.mkdirSync(path.join(__dirname,'..','test-results','auditoria','fase04'),{recursive:true});fs.mkdirSync(path.join(__dirname,'..','test-results','auditoria','fase04'),{recursive:true});fs.writeFileSync(path.join(__dirname,'..','test-results','auditoria','fase04',process.env.OUT||'tipografia.json'),JSON.stringify(res,null,1));
 for(const [k,v] of Object.entries(res)){const r=Object.values(v).filter(x=>!x.error);const pes=new Set(r.flatMap(x=>x.pesos));console.log(k,'pesos distintos',pes.size,[...pes].join(','),'| <12px',r.reduce((a,x)=>a+x.tiny,0),'| importes',r.reduce((a,x)=>a+x.importes,0),'recortados',r.reduce((a,x)=>a+x.recortados,0),'sin tabular',r.reduce((a,x)=>a+x.sinTabular,0),'| ≥800:',r.reduce((a,x)=>a+x.pesados,0))}
})().catch(e=>{console.error(e);process.exit(1)});
