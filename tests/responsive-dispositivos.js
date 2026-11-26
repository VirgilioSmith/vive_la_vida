'use strict';
/* Responsive en perfiles de tableta y móvil (emulación de viewport; NO sustituye un iPhone/iPad físico ni una PWA instalada).
   Comprueba por ruta: desborde horizontal de página, textos fuera del viewport y errores de consola. */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');const open=require('./harness');
const PAGES=['overview','register','flow','income','expenses','wallet','banks','accounts','cards','loans','certificates','mobilehub','budget','categories','recurring','personal','patrimony','advanced','settings','mobilesearch'];
const PERFILES=[['iPhone SE',375,667],['Android pequeño',360,740],['iPhone 15',393,852],['iPhone Pro Max',430,932],['iPad mini',744,1133],['iPad',820,1180],['iPad horizontal',1024,768],['iPad Pro 12.9',1024,1366],['Portátil',1280,800]];
(async()=>{
 const b=await chromium.launch(),res={};
 for(const [n,w,h] of PERFILES){
  process.env.THEME='light';if(w<800)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);const errs=[];p.on('pageerror',e=>errs.push(e.message));res[n]={ancho:w,rutas:{}};
  for(const pg of PAGES){try{await p.evaluate(id=>window.__T.go(id),pg);await p.waitForTimeout(350);
   res[n].rutas[pg]=await p.evaluate(()=>{const vw=innerWidth,f=[];for(const e of document.querySelectorAll('#app *')){if(!([...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())))continue;const b=e.getBoundingClientRect();if(b.width<2||b.height<2)continue;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')continue;
     let sc=false,q=e.parentElement;while(q&&q!==document.body){const o=getComputedStyle(q);if(/(auto|scroll|hidden|clip)/.test(o.overflowX)&&q.scrollWidth>q.clientWidth+1){sc=true;break}q=q.parentElement}
     if(!sc&&(b.right>vw+1||b.left<-1))f.push(e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0]+' «'+e.textContent.trim().slice(0,18)+'»')}
     return {ovX:document.documentElement.scrollWidth-vw,fuera:f.length,ej:f.slice(0,3)}})}catch(e){res[n].rutas[pg]={error:1}}}
  res[n].consola=errs.length;await ctx.close()}
 await b.close();fs.mkdirSync(path.join(__dirname,'..','test-results','auditoria','fase02'),{recursive:true});fs.mkdirSync(path.join(__dirname,'..','test-results','auditoria','fase02'),{recursive:true});fs.writeFileSync(path.join(__dirname,'..','test-results','auditoria','fase02','responsive.json'),JSON.stringify(res,null,1));
 for(const [n,v] of Object.entries(res)){const r=Object.entries(v.rutas);console.log(n,v.ancho,'desborde página:',r.filter(([,x])=>x.ovX>2).map(([k])=>k).join(',')||'ninguno','| texto fuera:',r.filter(([,x])=>x.fuera>0).map(([k,x])=>k+':'+x.fuera).join(',')||'ninguno','| consola',v.consola)}
})().catch(e=>{console.error(e);process.exit(1)});
