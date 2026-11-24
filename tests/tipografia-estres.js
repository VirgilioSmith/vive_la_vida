'use strict';
/* Fase 04 · Estrés tipográfico: zoom 200 %, importes gigantes, textos largos, estados vacíos y vistas de detalle (Trabajo formal / Joseo).
   Criterios: sin desborde horizontal de página, ningún importe recortado, solo pesos 400/500/600/700, sin NaN/undefined. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');const open=require('./harness');
const PAGES=['overview','register','flow','income','expenses','wallet','banks','accounts','cards','loans','certificates','budget','categories','recurring','personal','patrimony','advanced','settings'];
const AUDIT=()=>{const MONEY=/^\s*[-−+]?\s?(RD\$|US\$|\$)\s?[-−+]?\s?\d/;const bad=[];const W=new Set();const body=document.body.innerText;
 for(const e of document.querySelectorAll('#app *')){if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;const b=e.getBoundingClientRect();if(b.width<2||b.height<2)continue;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')continue;W.add(s.fontWeight);
  if(e.childElementCount===0&&MONEY.test(e.textContent)&&e.scrollWidth>e.clientWidth+1)bad.push(e.textContent.trim().slice(0,24))}
 return {ovX:document.documentElement.scrollWidth-innerWidth,money:bad.slice(0,4),nMoney:bad.length,pesos:[...W].sort(),nan:/NaN|undefined|Infinity|\[object/.test(body)}};
(async()=>{
 const b=await chromium.launch();const rep={};
 const run=async(name,w,h,prep,touch)=>{process.env.THEME='light';if(touch)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);const errs=[];p.on('pageerror',e=>errs.push(e.message));if(prep)await p.evaluate(prep);
  const out={};for(const pg of PAGES){await p.evaluate(id=>window.__T.go(id),pg);await p.waitForTimeout(350);out[pg]=await p.evaluate(AUDIT)}
  const peor=Object.entries(out).filter(([,x])=>x.ovX>2||x.nMoney>0||x.nan);rep[name]={fallos:peor.map(([k,x])=>k+(x.ovX>2?' ovX'+x.ovX:'')+(x.nMoney?' $recortado:'+x.money.join('|'):'')+(x.nan?' NaN':'')),pesosFuera:[...new Set(Object.values(out).flatMap(x=>x.pesos))].filter(x=>!['400','500','600','700'].includes(x)),errores:errs.length};
  await ctx.close()};
 await run('zoom200-pc (720x450)',720,450,null,false);
 await run('zoom200-movil (320x568)',320,568,null,true);
 const big=()=>{const d=window.__T.dbg(),acc=d.accounts[0];d.transactions.push({id:'big1',type:'income',date:window.__T.fn.today(),amount:98765432109.87,currency:'DOP',accountId:acc.id,category:'Otros ingresos',created:window.__T.fn.today()+'T10:00:00Z'});d.transactions.push({id:'big2',type:'expense',date:window.__T.fn.today(),amount:87654321098.76,currency:'DOP',accountId:acc.id,category:'Vivienda',created:window.__T.fn.today()+'T10:00:00Z'});d.banks[0].name='Institución financiera con un nombre extraordinariamente largo para probar el recorte';d.accounts[0].name='Cuenta de ahorro programado para vacaciones familiares de fin de año';window.__T.inv()};
 await run('importes gigantes + textos largos (PC)',1440,900,big,false);
 await run('importes gigantes + textos largos (móvil)',390,844,big,true);
 const empty=()=>{const d=window.__T.dbg();d.transactions=[];d.incomeSchedules=[];d.recurring=[];d.loans=[];window.__T.inv()};
 await run('estado vacío (PC)',1440,900,empty,false);
 await run('estado vacío (móvil)',390,844,empty,true);
 // detalle Trabajo formal / Joseo
 process.env.THEME='light';delete process.env.TOUCH;const {ctx,p}=await open(b,1440,900);
 await p.evaluate(()=>window.__T.go('flow'));await p.locator('.vflow-tabs button',{hasText:'Ingresos'}).click();await p.waitForSelector('.vinc-kpis');
 for(const [label,kind] of [['Trabajo formal','formal'],['Joseo','informal']]){await p.locator('.vinc-kpi-link',{hasText:label}).click();await p.waitForSelector(`.vincd-body[data-kind="${kind}"]`);
  const r=await p.evaluate(()=>{const W=new Set(),tiny=[];for(const e of document.querySelectorAll('.vincd *')){if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;const s=getComputedStyle(e);if(e.getBoundingClientRect().width<2)continue;W.add(s.fontWeight);if(parseFloat(s.fontSize)<12)tiny.push(e.textContent.trim().slice(0,14))}return {pesos:[...W],tiny,back:!!document.querySelector('.vincd-back'),ovX:document.documentElement.scrollWidth-innerWidth}});
  rep['detalle '+label]=r;assert.ok(r.back,'flecha de regreso');assert.ok(r.pesos.every(x=>['400','500','600','700'].includes(x)),'pesos '+label+': '+r.pesos);assert.equal(r.tiny.length,0,'texto <12px en '+label+': '+r.tiny);assert.ok(r.ovX<=2,'desborde '+label);
  await p.locator('.vincd-back').click();await p.waitForSelector('.vinc-kpis')}
 await ctx.close();await b.close();
 let fail=0;for(const [k,v] of Object.entries(rep)){const bad=(v.fallos&&v.fallos.length)||(v.pesosFuera&&v.pesosFuera.length)||v.errores;console.log(bad?'✕':'✓',k,JSON.stringify(v).slice(0,360));if(bad)fail++}
 if(fail)process.exit(1);console.log('tipografia-estres: OK');
})().catch(e=>{console.error(e);process.exit(1)});
