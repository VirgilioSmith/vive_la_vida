'use strict';
/* Ingresos → KPI Trabajo formal / Joseo → vista completa → flecha de regreso. Período conservado, historial del navegador, sin duplicar. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness');
(async()=>{
 const b=await chromium.launch();delete process.env.TOUCH;process.env.THEME='light';
 const {ctx,p}=await open(b,1440,900);const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const ok=(c,m)=>assert.ok(c,m);
 await p.evaluate(()=>window.__T.go('register'));
 await p.evaluate(()=>window.__T.go('flow'));await p.waitForSelector('.vflow-tabs');
 await p.locator('.vflow-tabs button',{hasText:'Ingresos'}).click();await p.waitForSelector('.vinc-kpis');
 const before=await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions));
 for(const [kind,label,expect] of [['formal','Trabajo formal',/Salario|nómina|NÓMINA|empleo/i],['informal','Trabajo informal',/Joseo|JOSEO|actividad|ingresos/i]]){
  for(const range of ['Mes','Año','Histórico']){
   await p.locator('.vexp-seg button',{hasText:range}).click();
   const kpi=p.locator('.vinc-kpi-link',{hasText:label});ok(await kpi.count()===1,`${kind}: KPI clicable único`);
   await kpi.click();await p.waitForSelector(`.vincd-body[data-kind="${kind}"]`);
   const txt=await p.locator('.vincd-body').innerText();ok(txt.length>200&&expect.test(txt),`${kind}/${range}: vista completa con contenido real`);
   ok(await p.locator('.vinc-kpis').count()===0,`${kind}: no duplica el resumen debajo`);
   ok(await p.locator('.vincd-back').innerText().then(t=>/Volver a Ingresos/.test(t)),'flecha «Volver a Ingresos»');
   ok(await p.locator('.vexp-seg .is-on').innerText()===range,`${kind}: conserva ${range} dentro del detalle`);
   await p.locator('.vincd-back').click();await p.waitForSelector('.vinc-kpis');
   ok(await p.locator('.vexp-seg .is-on').innerText()===range,`${kind}: conserva ${range} al volver`);
   ok(await p.locator('.vincd').count()===0,'vuelve al resumen de Ingresos');
  }
 }
 // botón Atrás del navegador
 await p.locator('.vinc-kpi-link',{hasText:'Trabajo formal'}).click();await p.waitForSelector('.vincd-body');
 await p.goBack();await p.waitForSelector('.vinc-kpis');ok(await p.locator('.vincd').count()===0,'Atrás del navegador regresa a Ingresos');
 // salir por otra pestaña limpia el detalle
 await p.locator('.vinc-kpi-link',{hasText:'Joseo'}).click();await p.waitForSelector('.vincd-body');
 await p.locator('.vflow-tabs button',{hasText:'Egresos'}).click();await p.waitForSelector('.vexp-kpi');
 await p.locator('.vflow-tabs button',{hasText:'Ingresos'}).click();await p.waitForSelector('.vinc-kpis');ok(await p.locator('.vincd').count()===0,'el detalle no queda pegado');
 ok(await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions))===before,'sin cambios en movimientos');
 // acciones reales presentes en el detalle
 await p.locator('.vinc-kpi-link',{hasText:'Trabajo formal'}).click();await p.waitForSelector('.vincd-body');
 ok(await p.locator('.vincd-body [data-v40-action="editIncome"],.vincd-body [data-v40-action="addIncome"],.vincd-body button').count()>0,'acciones de edición disponibles');
 await p.screenshot({path:'docs/auditoria/fase02/ingresos-formal.jpg',type:'jpeg',quality:70});
 await p.locator('.vincd-back').click();await p.waitForSelector('.vinc-kpis');await p.locator('.vinc-kpi-link',{hasText:'Joseo'}).click();await p.waitForSelector('.vincd-body[data-kind="informal"]');
 await p.screenshot({path:'docs/auditoria/fase02/ingresos-joseo.jpg',type:'jpeg',quality:70});
 ok(errs.length===0,'consola: '+errs.join('|'));
 await ctx.close();await b.close();console.log('ingresos-detalle: OK');
})().catch(e=>{console.error(e);process.exit(1)});
