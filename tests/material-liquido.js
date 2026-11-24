'use strict';
/* Fase 03 · Motor Liquid Glass: mide por ruta (PC/móvil × Claro/Black) cuántas superficies usan backdrop-filter, cuántas están anidadas,
   cuántas superficies grandes siguen opacas, y que las listas largas no lleven filtro por fila. Informe: docs/auditoria/fase03/material.json */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');const open=require('./harness');
const PAGES=['overview','register','flow','income','expenses','wallet','banks','accounts','cards','loans','certificates','mobilehub','budget','categories','recurring','personal','patrimony','advanced','settings','mobilesearch'];
const P=()=>{
 const bf=e=>{const s=getComputedStyle(e);const v=s.backdropFilter&&s.backdropFilter!=='none'?s.backdropFilter:(s.webkitBackdropFilter&&s.webkitBackdropFilter!=='none'?s.webkitBackdropFilter:'');return v};
 const vis=e=>{const b=e.getBoundingClientRect();if(b.width<2||b.height<2)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'};
 const all=[...document.querySelectorAll('#app *')].filter(vis);
 const blur=all.filter(e=>bf(e));
 const nested=blur.filter(e=>{let q=e.parentElement;while(q&&q.id!=='app'){if(bf(q))return true;q=q.parentElement}return false});
 const dark=/black|dark/.test(document.body.className);
 const opaque=all.filter(e=>{const b=e.getBoundingClientRect();if(b.width*b.height<20000)return false;const m=getComputedStyle(e).backgroundColor.match(/rgba?\(([^)]+)\)/);if(!m)return false;const [r,g,bl,a=1]=m[1].split(',').map(Number);if(a<.97)return false;return dark?((r+g+bl)/3>200):((r+g+bl)/3>=250)});
 const sibs=new Map();for(const e of blur){const k=e.parentElement;sibs.set(k,(sibs.get(k)||0)+1)}
 const lista=[...sibs.values()].filter(n=>n>=12).length;
 const cls=e=>e.tagName.toLowerCase()+'.'+String(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className).split(' ')[0];
 const radius=Math.max(0,...blur.map(e=>parseFloat((bf(e).match(/blur\(([\d.]+)px/)||[0,0])[1])));
 return {blur:blur.length,nested:nested.length,nestedEj:nested.slice(0,3).map(cls),opaque:opaque.length,opaqueEj:opaque.slice(0,3).map(cls),listaConFiltro:lista,maxBlur:radius,
  area:Math.round(blur.reduce((a,e)=>{const b=e.getBoundingClientRect();return a+b.width*b.height},0)/(innerWidth*innerHeight)*100)/100}};
(async()=>{
 const b=await chromium.launch(),res={};
 for(const [w,h,pl] of [[1440,900,'pc'],[390,844,'movil']])for(const theme of ['light','black']){
  process.env.THEME=theme;if(w<800)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);const k=pl+'-'+theme;res[k]={};
  for(const pg of PAGES){try{await p.evaluate(id=>window.__T.go(id),pg);await p.waitForTimeout(400);res[k][pg]=await p.evaluate(P)}catch(e){res[k][pg]={error:1}}}
  await ctx.close()}
 await b.close();const out=path.join(__dirname,'..','docs','auditoria','fase03');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,process.env.OUT||'material.json'),JSON.stringify(res,null,1));
 for(const [k,v] of Object.entries(res)){const r=Object.values(v).filter(x=>!x.error);console.log(k,'blur/ruta máx',Math.max(...r.map(x=>x.blur)),'anidados total',r.reduce((a,x)=>a+x.nested,0),'opacas total',r.reduce((a,x)=>a+x.opaque,0),'listas con filtro',r.reduce((a,x)=>a+x.listaConFiltro,0),'blur máx px',Math.max(...r.map(x=>x.maxBlur)),'área máx',Math.max(...r.map(x=>x.area)))}
})().catch(e=>{console.error(e);process.exit(1)});
