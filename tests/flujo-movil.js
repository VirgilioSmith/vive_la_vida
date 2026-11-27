'use strict';
/* Movimientos → Flujo (móvil): Flujo | Ingresos | Egresos con las vistas de PC adaptadas. Navegación, Mes|Año|Histórico compartido, KPI iguales a PC,
   seis clasificaciones de Egresos, categorías expandibles, detalle de Trabajo formal/Joseo con flecha, 320–430 px, Claro/Black, sin vistas antiguas. */
const assert=require('node:assert/strict');const path=require('node:path');
const {chromium}=require('playwright');const open=require('./harness');
const OUT=path.join(__dirname,'..','test-results','auditoria','flujo-movil');
const kpis=p=>p.evaluate(()=>({flow:[...document.querySelectorAll('.vflow-kpi strong')].map(e=>e.textContent),inc:[...document.querySelectorAll('.vinc-kpi strong')].map(e=>e.textContent),exp:[...document.querySelectorAll('.vexp-kpi strong')].map(e=>e.textContent)}));
(async()=>{
 const b=await chromium.launch();
 // referencia PC
 delete process.env.TOUCH;process.env.THEME='light';const pc={};
 {const {ctx,p}=await open(b,1440,900);for(const [pg,k] of [['flow','flow'],['income','inc'],['expenses','exp']]){await p.evaluate(id=>window.__T.go(id),pg);await p.waitForTimeout(400);pc[pg]=(await kpis(p))[k]}await ctx.close()}
 for(const theme of ['light','black'])for(const w of [320,360,375,390,430]){
  process.env.THEME=theme;process.env.TOUCH='1';const {ctx,p}=await open(b,w,844);const errs=[];p.on('pageerror',e=>errs.push(e.message));const tag=`${theme}-${w}`;const ok=(c,m)=>assert.ok(c,`[${tag}] ${m}`);
  const base=await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions));
  for(const [pg,k,sel] of [['flow','flow','.vflow-kpis'],['income','inc','.vinc-kpis'],['expenses','exp','.vexp-kpis']]){
   await p.evaluate(id=>window.__T.go(id),pg);await p.waitForSelector(sel);await p.waitForTimeout(300);
   const g=await p.evaluate(()=>({tabs:[...document.querySelectorAll('.vflow-tabs button')].map(x=>x.textContent.trim()),on:document.querySelector('.vflow-tabs .is-on')?.textContent.trim(),seg:[...document.querySelectorAll('.vexp-seg button')].map(x=>x.textContent.trim()),old:!!document.querySelector('.v58-exec[data-v58-page="income"],.v58-exec[data-v58-page="expenses"]'),ovX:document.documentElement.scrollWidth-innerWidth,
    clip:[...document.querySelectorAll('.vexp *')].filter(e=>e.children.length===0&&!e.closest('.vi-strip')&&/(RD\$|US\$)\s?\d/.test(e.textContent)&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.slice(0,14)),
    h1:document.querySelector('.vflow-title h1,.vinc-title h1')?.textContent.trim(),weights:[...new Set([...document.querySelectorAll('.vexp *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>getComputedStyle(e).fontWeight))]}));
   ok(g.tabs.join('|')==='Flujo|Ingresos|Egresos','pestañas Flujo|Ingresos|Egresos '+g.tabs);ok(g.seg.join('|')==='Mes|Año|Histórico','Mes|Año|Histórico');ok(!g.old,'sin resumen ejecutivo antiguo');ok(g.ovX<=1,`${pg} sin scroll horizontal`);ok(g.clip.length===0,`${pg} importes completos ${g.clip}`);ok(g.weights.every(x=>['400','500','600','700'].includes(x)),'pesos '+g.weights);
   ok(JSON.stringify((await kpis(p))[k])===JSON.stringify(pc[pg]),`${pg}: KPI idénticos a PC ${JSON.stringify((await kpis(p))[k])} vs ${JSON.stringify(pc[pg])}`);
   if(w===390&&['light','black'].includes(theme))await p.screenshot({path:path.join(OUT,`${pg}-${theme}-390.jpg`),type:'jpeg',quality:70,fullPage:true});
  }
  if(w===390&&theme==='light'){
   // navegación entre pestañas y período compartido
   await p.evaluate(()=>window.__T.go('flow'));await p.waitForSelector('.vflow-kpis');
   await p.locator('.vexp-seg button',{hasText:'Año'}).click();
   for(const t of ['Ingresos','Egresos','Flujo']){await p.locator('.vflow-tabs button',{hasText:t}).click();await p.waitForTimeout(300);ok(await p.locator('.vexp-seg .is-on').innerText()==='Año',`período Año conservado en ${t}`)}
   await p.locator('.vexp-seg button',{hasText:'Histórico'}).click();await p.locator('.vflow-tabs button',{hasText:'Egresos'}).click();await p.waitForSelector('.vexp-kpis');ok(await p.locator('.vexp-seg .is-on').innerText()==='Histórico','Histórico conservado');
   await p.locator('.vexp-seg button',{hasText:'Mes'}).click();
   // Egresos: seis clasificaciones y categorías expandibles
   const where=await p.evaluate(()=>[...document.querySelectorAll('.vexp-inst')].map(e=>e.querySelector('span:nth-child(2)')?.textContent.trim()));
   ok(JSON.stringify(where)===JSON.stringify(['Tarjetas de crédito','Cuentas y efectivo','Costos de tarjetas','Costos de préstamos','Costos del pago de tarjeta','Costos de la operación']),'seis clasificaciones '+where);
   const cat=p.locator('details.vexp-cat').first();await cat.locator('summary').click();ok(await cat.evaluate(e=>e.open&&e.querySelectorAll('.vexp-sub').length>0),'categoría expandible con subcategorías');
   await p.locator('.vexp-kind button',{hasText:'Fijas'}).click();await p.waitForTimeout(250);ok(await p.locator('details.vexp-cat').count()>0,'filtro Fijas');await p.locator('.vexp-kind button',{hasText:'Todas'}).click();
   // Ingresos: KPI → detalle completo → flecha
   await p.locator('.vflow-tabs button',{hasText:'Ingresos'}).click();await p.waitForSelector('.vinc-kpis');
   for(const [lab,kind] of [['Trabajo formal','formal'],['Joseo','informal']]){await p.locator('.vinc-kpi-link',{hasText:lab}).click();await p.waitForSelector(`.vincd-body[data-kind="${kind}"]`);ok((await p.locator('.vincd-body').innerText()).length>200,`${lab}: vista completa`);ok(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1),`${lab}: sin scroll horizontal`);await p.locator('.vincd-back').click();await p.waitForSelector('.vinc-kpis')}
   // el libro no cambia
   ok(await p.evaluate(b=>JSON.stringify(window.__T.dbg().transactions)===b,base),'sin cambios en movimientos');
  }
  ok(errs.length===0,'consola '+errs.join('|'));await ctx.close();
 }
 await b.close();console.log('flujo-movil: OK');
})().catch(e=>{console.error(e);process.exit(1)});
