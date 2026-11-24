'use strict';
/* Movimientos → Flujo → Flujo | Ingresos | Egresos (PC) + Ingresos PC Liquid Glass. Datos aislados.
   Verifica navegación, período compartido (Mes|Año|Histórico), KPI, composición, gráficos, pestañas, consistencia
   Flujo = Ingresos − Egresos (nómina sin doble conteo), acciones, Claro/Black/acentos, consola y desbordes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const open=require('./harness');
const OUT=path.join(__dirname,'..','docs','auditoria','flujo-ingresos');
const num=s=>Number(String(s).replace(/[^0-9.\-]/g,''));

async function fixture(p){
 return p.evaluate(()=>{
  const t=window.__T,d=t.dbg(),today=t.fn.today(),month=today.slice(0,7),[y,m]=month.split('-').map(Number);
  const prev=m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0');
  const acc=d.accounts.find(a=>a.currency==='DOP')||d.accounts[0];
  d.incomeSchedules=[{id:'sch-f',name:'Nómina prueba',kind:'formal',currency:'DOP',frequency:'monthly',grossMonthly:100000,nextDue:today,active:true,postingMode:'confirm',accountId:acc.id}];
  const base={currency:'DOP',accountId:acc.id},snap={kind:'formal',gross:90578,afp:1000,sfs:1677,isr:7268,other:633,generalOther:633,companyItems:[]};
  d.transactions=[
   {...base,id:'f1',type:'income',date:month+'-05',amount:80000,category:'Salario y nómina',incomeScheduleId:'sch-f',payrollSnapshot:snap},
   {...base,id:'j1',type:'income',date:month+'-06',amount:20000,category:'Joseo e ingresos adicionales'},
   {...base,id:'o1',type:'income',date:month+'-07',amount:1000,category:'Otros ingresos'},
   {...base,id:'f0',type:'income',date:prev+'-05',amount:80000,category:'Salario y nómina',incomeScheduleId:'sch-f',payrollSnapshot:{...snap}},
   {...base,id:'j0',type:'income',date:prev+'-06',amount:10000,category:'Joseo e ingresos adicionales'},
   {...base,id:'e1',type:'expense',date:month+'-03',amount:10000,category:'Vivienda',subcategory:'Alquiler'},
   {...base,id:'e2',type:'expense',date:month+'-04',amount:3000,category:'Alimentación',subcategory:'Supermercado'}
  ].map(x=>({...x,created:x.date+'T10:00:00Z'}));
  t.ui().month=month;t.ui().expenseRange='month';t.ui().vIncChart='monthly';t.inv();
  return {ledger:JSON.stringify(d.transactions),balance:t.fn.getAccountBalance(acc)};
 });
}
async function run(browser,{theme,palhex,width=1440,height=900,shot}){
 delete process.env.TOUCH;process.env.THEME=theme;if(palhex)process.env.PALHEX=palhex;else delete process.env.PALHEX;
 const {ctx,p}=await open(browser,width,height);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const tag=`${theme}${palhex?' '+palhex:''} ${width}`;const ok=(c,msg)=>assert.ok(c,`[${tag}] ${msg}`);
 await p.evaluate(()=>window.__T.go('overview'));const seeded=await fixture(p);
 // navegación: Movimientos muestra Flujo (no Ingresos/Egresos sueltos)
 await p.evaluate(()=>window.__T.go('register'));await p.waitForSelector('.module-switch-tabs');
 const top=await p.locator('.module-switch-tabs button').allInnerTexts();
 ok(top.includes('Flujo')&&!top.includes('Ingresos')&&!top.includes('Egresos'),'Movimientos → Flujo reemplaza Ingresos y Egresos: '+top.join('|'));
 await p.locator('.module-switch-tabs button',{hasText:'Flujo'}).click();await p.waitForSelector('.vflow-kpi');
 assert.deepEqual(await p.locator('.vflow-tabs button').allInnerTexts(),['Flujo','Ingresos','Egresos'],'tres vistas');
 ok(await p.locator('.vflow-tabs .is-on').innerText()==='Flujo','Flujo es la vista predeterminada');
 // Flujo: consistencia contable
 let k=await p.locator('.vflow-kpi strong').allInnerTexts();
 assert.equal(num(k[0]),111578,`[${tag}] Flujo·Ingresos = 101,000 neto + 10,578 retenido: ${k[0]}`);
 assert.equal(num(k[1]),23578,`[${tag}] Flujo·Egresos = 13,000 + 10,578: ${k[1]}`);
 assert.equal(num(k[2]),88000,`[${tag}] Resultado neto = efectivo recibido − gasto en efectivo = 88,000: ${k[2]}`);
 ok(/78\.9%/.test(await p.locator('.vflow-donut strong').innerText()),'tasa de ahorro = 88,000 / 111,578 = 78.9%');
 await p.locator('.vflow-evo .vexp-kind button',{hasText:'Tendencia'}).click();ok(await p.locator('.vflow-ln.is-inc').count()===1,'Tendencia dibuja líneas');
 await p.locator('.vflow-evo .vexp-kind button',{hasText:'Montos'}).click();ok(await p.locator('.vflow-inc').count()>=1,'Montos dibuja columnas');
 // período compartido: Año en Flujo se conserva en Ingresos y Egresos
 await p.locator('.vexp-seg button',{hasText:'Año'}).click();
 await p.locator('.vflow-tabs button',{hasText:'Ingresos'}).click();await p.waitForSelector('.vinc-kpi');
 ok(await p.locator('.vexp-seg .is-on').innerText()==='Año','el período se conserva al cambiar a Ingresos');
 k=await p.locator('.vinc-kpi strong').allInnerTexts();
 assert.equal(num(k[0]),191000,`[${tag}] Año: ingresos = 101,000 + 90,000: ${k[0]}`);
 await p.locator('.vflow-tabs button',{hasText:'Egresos'}).click();await p.waitForSelector('.vexp-kpi');
 ok(await p.locator('.vexp-seg .is-on').innerText()==='Año','el período se conserva en Egresos');
 await p.locator('.vflow-tabs button',{hasText:'Ingresos'}).click();await p.locator('.vexp-seg button',{hasText:'Mes'}).click();
 // Ingresos · Resumen
 assert.deepEqual(await p.locator('.vinc-kpi>div>span:first-child').allInnerTexts(),['Ingresos del período','Trabajo formal','Trabajo informal · Joseo','Previsto / mes']);
 k=await p.locator('.vinc-kpi strong').allInnerTexts();
 assert.equal(num(k[0]),101000);assert.equal(num(k[1]),80000);assert.equal(num(k[2]),20000);
 ok(/79\.2% del total/.test(await p.locator('.vinc-k2').innerText()),'formal = 79.2% del total');
 ok(/Proyección mensual/.test(await p.locator('.vinc-k4').innerText()),'Previsto / mes diferenciado de lo recibido');
 const pct=(await p.locator('.vinc-crow em').allInnerTexts()).reduce((n,x)=>n+num(x),0);ok(Math.abs(pct-100)<.3,'la composición suma 100%: '+pct);
 const comp=(await p.locator('.vinc-crow b').allInnerTexts()).reduce((n,x)=>n+num(x),0);assert.equal(comp,101000,`[${tag}] la composición reconcilia con el total`);
 ok(await p.locator('.vinc-seg').count()>=3,'la dona dibuja un segmento por origen (formal, informal, otros)');
 ok(await p.locator('.vinc-bottom .vinc-card').count()===3,'tres tarjetas inferiores');
 // gráfico: acumulado e interanual
 await p.locator('.vinc-evo .vexp-kind button',{hasText:'Acumulado'}).click();ok(await p.locator('.vinc-evo .vexp-kind .is-on').innerText()==='Acumulado','toggle Acumulado');
 ok(/RD\$190(\.0)?K/.test(await p.locator('.vinc-evo .vexp-bubt').textContent()),'acumulado formal+informal = 190K (otros 1K solo en composición): '+await p.locator('.vinc-evo .vexp-bubt').textContent());
 await p.locator('.vinc-evo .vexp-kind button',{hasText:'Interanual'}).click();ok(await p.locator('.vinc-prev').count()>=1,'Interanual compara con el año anterior');
 await p.locator('.vinc-evo .vexp-kind button',{hasText:'Mensual'}).click();
 // Histórico
 await p.locator('.vexp-seg button',{hasText:'Histórico'}).click();
 k=await p.locator('.vinc-kpi strong').allInnerTexts();assert.equal(num(k[0]),191000,`[${tag}] histórico = todo lo registrado`);
 await p.locator('.vexp-seg button',{hasText:'Mes'}).click();
 // vista única: sin barra de pestañas secundaria; Resumen contiene todo
 ok(await p.locator('.vinc-tabs').count()===0,'Ingresos no tiene pestañas secundarias');
 ok(await p.locator('.vinc-more').count()===0,'sin botones Ver detalle / Ver todo');
 ok(await p.locator('.vinc-bottom .vinc-card').count()===3,'formal, informal y actividad reciente en la misma vista');
 ok(await p.locator('.vinc-hact').getByText('+ Agregar fuente').count()===1,'Agregar fuente en el encabezado');
 ok(await p.locator('.vinc-hact').getByText('Registrar cobro anticipado').count()===1,'Registrar cobro anticipado en el encabezado');
 ok(await p.locator('.vinc-act').count()===3,'actividad reciente con los últimos ingresos');
 // acciones
 await p.locator('.vinc-reg').click();await p.waitForTimeout(500);ok(await p.evaluate(()=>document.querySelector('#modal-root').children.length>0),'Registrar ingreso abre el formulario');
 await p.evaluate(()=>{document.getElementById('modal-root').innerHTML=''});
 // integridad
 const after=await p.evaluate(()=>{const t=window.__T,d=t.dbg();return {ledger:JSON.stringify(d.transactions),balance:t.fn.getAccountBalance(d.accounts.find(a=>a.currency==='DOP')||d.accounts[0])}});
 assert.equal(after.ledger,seeded.ledger,'los movimientos no cambian');assert.equal(after.balance,seeded.balance,'el saldo no cambia');
 ok(!/NaN|undefined|Infinity/.test(await p.locator('#page').innerText()),'sin NaN');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sin desborde horizontal');
 ok(await p.evaluate(()=>[...document.querySelectorAll('.vinc-kpi strong,.vflow-kpi strong,.vinc-big strong')].every(e=>e.scrollWidth<=e.clientWidth+1)),'importes sin recortes');
 ok(errors.length===0,'consola: '+errors.join(' | '));
 if(shot){fs.mkdirSync(OUT,{recursive:true});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(OUT,shot)})}
 await ctx.close();
}
async function movil(browser){
 process.env.TOUCH='1';process.env.THEME='light';delete process.env.PALHEX;
 const {ctx,p}=await open(browser,390,844);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.evaluate(()=>window.__T.go('overview'));await fixture(p);
 for(const r of ['flow','income','expenses']){await p.evaluate(v=>window.__T.go(v),r);await p.waitForTimeout(400);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`móvil ${r}: sin desborde`)}
 await p.evaluate(()=>window.__T.go('flow'));assert.ok(await p.locator('.vflow-kpi').count()===3,'móvil: Flujo muestra tres KPI');
 assert.deepEqual(errors,[]);await ctx.close();delete process.env.TOUCH;
}
module.exports=async function flujoIngresosPc(browser){
 for(const c of [{theme:'light',shot:'claro-1440.png'},{theme:'black',shot:'black-1440.png'},{theme:'light',palhex:'#16a085',shot:'claro-verde-1440.png'},{theme:'light',width:1280,height:800,shot:'claro-1280.png'},{theme:'light',width:1672,height:941,shot:'claro-1672.png'}])await run(browser,c);
 await movil(browser);
 console.log('Flujo + Ingresos PC validado con Playwright: navegación, período compartido, KPI, composición, gráficos, pestañas, consistencia contable, Claro/Black/acentos, 3 anchos y móvil sin desborde.');
};
if(require.main===module)(async()=>{const b=await chromium.launch();try{await module.exports(b)}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
