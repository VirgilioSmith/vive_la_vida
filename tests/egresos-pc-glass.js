'use strict';
/* Egresos PC · Premium Liquid Glass + nómina integrada. Datos de prueba aislados (no tocan datos reales):
   valida KPI, detalle de categoría/subcategorías, filtros Fijas/Variables, selector Mes|Año|Histórico, deducciones de nómina
   (RD$7,268 + 1,677 + 1,633 = 10,578) sin duplicarse ni alterar saldos/movimientos, ausencia de Pareto/comercios/tarjeta de deducciones,
   Claro/Black, acentos, desbordes y consola. Capturas en docs/auditoria/egresos-pc/. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const open=require('./harness');
const OUT=path.join(__dirname,'..','docs','auditoria','egresos-pc');
const num=s=>Number(String(s).replace(/[^0-9.\-]/g,''));

async function fixture(p){
 return p.evaluate(()=>{
  const t=window.__T,d=t.dbg(),today=t.fn.today(),month=today.slice(0,7),[y,m]=month.split('-').map(Number);
  const prev=m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0');
  const acc=d.accounts.find(a=>a.currency==='DOP')||d.accounts[0];
  d.incomeSchedules=[{id:'sch-1',name:'Nómina prueba',kind:'formal',currency:'DOP',frequency:'monthly'}];
  const base={currency:'DOP',accountId:acc.id};
  d.transactions=[
   {...base,id:'e1',type:'expense',date:month+'-03',amount:10000,category:'Vivienda',subcategory:'Alquiler'},
   {...base,id:'e2',type:'expense',date:month+'-04',amount:3000,category:'Alimentación',subcategory:'Supermercado'},
   {...base,id:'e3',type:'expense',date:prev+'-04',amount:8000,category:'Vivienda',subcategory:'Alquiler'},
   {...base,id:'i1',type:'income',date:month+'-05',amount:80000,category:'Salario y nómina',incomeScheduleId:'sch-1',payrollSnapshot:{gross:90578,afp:1000,sfs:1677,isr:7268,other:633,generalOther:633,companyItems:[]}}
  ].map(x=>({...x,created:x.date+'T10:00:00Z'}));
  t.ui().month=month;t.ui().expenseRange='month';t.inv();
  return {ledger:JSON.stringify(d.transactions),balance:t.fn.getAccountBalance(acc)};
 });
}
const kpiVals=p=>p.locator('.vexp-kpi strong').allInnerTexts();
const catTotal=p=>p.locator('.vexp-cat>summary b').allInnerTexts().then(a=>a.reduce((n,x)=>n+num(x),0));

async function run(browser,{theme,palhex,width=1440,height=900,shot}){
 delete process.env.TOUCH;process.env.THEME=theme;if(palhex)process.env.PALHEX=palhex;else delete process.env.PALHEX;
 const {ctx,p}=await open(browser,width,height);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const tag=`${theme}${palhex?' '+palhex:''} ${width}`;const ok=(c,msg)=>assert.ok(c,`[${tag}] ${msg}`);
 await p.evaluate(()=>window.__T.go('overview'));
 const seeded=await fixture(p);
 await p.evaluate(()=>window.__T.go('expenses'));await p.waitForSelector('.vexp-kpi');
 // estructura
 ok(await p.locator('.vexp-seg button').count()===3,'píldora con Mes | Año | Histórico');
 assert.deepEqual(await p.locator('.vexp-seg button').allInnerTexts(),['Mes','Año','Histórico']);
 assert.deepEqual(await p.locator('.vexp-kpi>div>span:first-child').allInnerTexts(),['Total gastado','Gastos fijos','Gastos variables','Presupuesto restante']);
 const body=await p.locator('#page').innerText();
 ok(!/Pareto|Composición del gasto|Principales comercios|Deducciones en categorías de gastos/i.test(body),'sin Pareto, dona, comercios ni tarjeta de deducciones');
 ok(await p.locator('.v58-exec[data-v58-page="expenses"]').isVisible().catch(()=>false)===false,'resumen anterior oculto (sin controles duplicados)');
 ok(await p.locator('.vexp-inst').count()===6,'seis filas de instrumento/costo');
 // mes: nómina integrada
 let k=await kpiVals(p);
 assert.equal(num(k[0]),23578,`[${tag}] total gastado = 13,000 + 10,578 de nómina: ${k[0]}`);
 assert.equal(num(k[1]),20578,`[${tag}] fijos = alquiler 10,000 + nómina 10,578: ${k[1]}`);
 assert.equal(num(k[2]),3000,`[${tag}] variables = 3,000: ${k[2]}`);
 ok(Math.abs(await catTotal(p)-23578)<1,'las categorías reconcilian con el total');
 const cat=n=>p.locator('.vexp-cat',{hasText:n}).first();
 for(const [c,amt] of [['Impuestos y comisiones',7268],['Salud',1677],['Otros gastos',1633]]){
  const row=cat(c);ok(await row.count()===1,`categoría ${c} presente`);
  assert.equal(num(await row.locator('summary b').innerText()),amt,`[${tag}] ${c} = ${amt}`);
 }
 // expandir / contraer y subcategorías
 await cat('Salud').locator('summary').click();ok(await cat('Salud').evaluate(e=>e.open),'expande');
 ok(/Seguro médico/.test(await cat('Salud').innerText()),'subcategoría Seguro médico (SFS / ARS)');
 const subs=await cat('Salud').locator('.vexp-sub b').allInnerTexts();ok(Math.abs(subs.reduce((n,x)=>n+num(x),0)-1677)<.01,'subcategorías suman su categoría');
 ok(/100\.0%/.test(await cat('Salud').locator('.vexp-sub em').first().innerText()),'subcategoría única = 100% de su categoría');
 await cat('Salud').locator('summary').click();ok(!(await cat('Salud').evaluate(e=>e.open)),'contrae');
 await cat('Otros gastos').locator('summary').click();
 ok(/AFP/.test(await cat('Otros gastos').innerText()),'AFP dentro de Otros gastos');
 // filtros fijas / variables
 await p.locator('.vexp-kind button',{hasText:'Fijas'}).click();
 ok(await cat('Vivienda').count()===1&&await cat('Alimentación').count()===0,'Fijas: Vivienda sí, Alimentación no');
 await p.locator('.vexp-kind button',{hasText:'Variables'}).click();
 ok(await cat('Alimentación').count()===1&&await cat('Vivienda').count()===0,'Variables: Alimentación sí, Vivienda no');
 await p.locator('.vexp-kind button',{hasText:'Todas'}).click();
 // variación sin flechas
 const varText=await p.locator('.vexp-kpi-1 .vexp-var-row').innerText();ok(/vs mes ant\./.test(varText)&&!/[▲▼↑↓]/.test(varText),'variación sin flechas');
 // año
 await p.locator('.vexp-seg button',{hasText:'Año'}).click();await p.waitForTimeout(150);
 k=await kpiVals(p);assert.equal(num(k[0]),23578+8000,`[${tag}] año = mes actual + mes anterior (si es mismo año) o solo actual`.replace('mes anterior (si es mismo año) o solo actual','mes anterior')) ;
 ok(/vs año ant\.|Sin base/.test(await p.locator('.vexp-kpi-1 .vexp-var-row').innerText()),'comparación anual');
 ok(await p.locator('.vexp-seg button.is-on').innerText()==='Año','segmento activo = Año');
 // histórico
 await p.locator('.vexp-seg button',{hasText:'Histórico'}).click();await p.waitForTimeout(150);
 k=await kpiVals(p);assert.equal(num(k[0]),31578,`[${tag}] histórico incluye todo lo registrado`);
 ok(/Sin base comparable/.test(await p.locator('.vexp-kpi-1 .vexp-var-row').innerText()),'histórico sin variación inventada');
 ok(Math.abs(await catTotal(p)-31578)<1,'histórico reconcilia');
 ok(!/NaN|undefined|Infinity/.test(await p.locator('#page').innerText()),'sin NaN/undefined');
 await p.locator('.vexp-seg button',{hasText:'Mes'}).click();
 // integridad: no se alteraron movimientos ni saldos
 const after=await p.evaluate(()=>{const t=window.__T,d=t.dbg();return {ledger:JSON.stringify(d.transactions),balance:t.fn.getAccountBalance(d.accounts.find(a=>a.currency==='DOP')||d.accounts[0])}});
 assert.equal(after.ledger,seeded.ledger,'los movimientos no cambian');assert.equal(after.balance,seeded.balance,'el saldo bancario no cambia');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sin desborde horizontal');
 ok(await p.evaluate(()=>[...document.querySelectorAll('.vexp-kpi strong,.vexp-cat b,.vexp-inst b')].every(e=>e.scrollWidth<=e.clientWidth+1)),'importes sin recortes');
 ok(await p.evaluate(()=>[...document.querySelectorAll('.vexp-var-row')].every(r=>r.getBoundingClientRect().right<=r.closest('article,section').getBoundingClientRect().right+1)),'cápsulas de variación dentro de su tarjeta');
 ok(await p.evaluate(()=>[...document.querySelectorAll('.vexp-cat>summary strong')].every(e=>e.scrollWidth<=e.clientWidth+1)),'nombres de categoría completos');
 ok(errors.length===0,'consola: '+errors.join(' | '));
 if(shot){fs.mkdirSync(OUT,{recursive:true});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(OUT,shot)})}
 await ctx.close();
}
module.exports=async function egresosPcGlass(browser){
 const cfgs=[{theme:'light',shot:'claro-1440.png'},{theme:'black',shot:'black-1440.png'},{theme:'light',palhex:'#16a085',shot:'claro-verde-1440.png'},{theme:'black',palhex:'#e0457b',shot:'black-rosa-1440.png'},
  {theme:'light',width:1280,height:800,shot:'claro-1280.png'},{theme:'light',width:1672,height:941,shot:'claro-1672.png'},{theme:'light',width:1920,height:1080,shot:'claro-1920.png'}];
 for(const c of cfgs)await run(browser,c);
 console.log('Egresos PC validado con Playwright: nómina integrada sin duplicar, Mes/Año/Histórico, Claro/Black, acentos y 4 resoluciones.');
};
if(require.main===module)(async()=>{const b=await chromium.launch();try{await module.exports(b)}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
