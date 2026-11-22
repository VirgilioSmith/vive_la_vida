/* Playwright audit: real UI and ledger, isolated shared relational server mock.
   No production traffic, sessions or balances. */
'use strict';
process.env.NOBOOT='1';
process.env.MOCKFILE='mock-servidor.js';
process.env.TOUCH='1';
process.env.RECONCILIATION_AUDIT='1';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const open=require('./harness');
const {Servidor}=require('./lib-servidor');
const engine=process.env.RECONCILIATION_BROWSER||'chromium';
const dir=path.resolve(__dirname,'../test-results/conciliacion',engine);
fs.mkdirSync(dir,{recursive:true});
const checks=[];
function check(label,actual,expected=true){assert.deepEqual(actual,expected,label);checks.push(label);console.log('✓ '+label)}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<60;i++){if(await fn())return;await wait(250)}throw Error('Tiempo agotado: '+label)}
const sync=p=>p.evaluate(()=>window.__T.sync());
async function flush(p){
 await until(async()=>{let s=await sync(p);if(s.dirty&&!s.saving&&!s.conflict)await p.evaluate(()=>{window.__T.unbackoff();return window.__T.flush()});s=await sync(p);return s.active&&!s.dirty&&!s.saving&&!s.conflict},'guardado confirmado');
}
async function session(browser,srv,who,width=390,height=844){
 const {p,ctx}=await open(browser,width,height,ctx=>ctx.exposeFunction('__srv',(op,payload)=>op==='rpc'?srv.rpc(payload,who):srv.read(payload)));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await until(async()=>(await sync(p)).active,'sesión');
 return {p,ctx,errors};
}
const clickAct=(p,act,id='')=>p.evaluate(([act,id])=>{const b=document.createElement('button');b.dataset.act=act;b.dataset.id=id;document.body.append(b);b.click();b.remove()},[act,id]);
const form=p=>p.locator('#vReconcileForm');
const shot=(p,name)=>p.screenshot({path:path.join(dir,name+'.png')});
const txs=(p,id)=>p.evaluate(id=>window.__T.dbg().transactions.filter(t=>t.type==='adjustment'&&t.accountId===id),id);
const balance=(p,id,day)=>p.evaluate(([id,day])=>{const d=window.__T.dbg();return window.__T.fn.getAccountBalance(d.accounts.find(a=>a.id===id),day||undefined)},[id,day]);
const ledger=(p,id)=>p.evaluate(id=>window.__T.ledger(id),id);
const totals=p=>p.evaluate(()=>{const m=window.__T.mt();return [m.income,m.expense,m.cashIn,m.cashOut]});
const ending=p=>p.evaluate(()=>window.__T.wealth().net);
const capture=(p,key)=>form(p).locator('[data-reconcile='+key+']').innerText();
async function enter(p,id,amount,date){
 await clickAct(p,'otherAdjust');
 await form(p).waitFor();
 await form(p).locator('.v-reconcile-account').click();
 await p.locator('.v-reconcile-account-picker [data-value="'+id+'"]').click();
 if(date)await form(p).locator('[name=date]').fill(date);
 await form(p).locator('[name=observed]').fill(String(amount));
}
async function confirm(p){
 await form(p).locator('button[type=submit]').click();
 await until(async()=>{if(!(await form(p).count()))return true;if(await form(p).locator('.v-reconcile-error').isVisible())throw Error(await form(p).locator('.v-reconcile-error').innerText());return false},'cierre de conciliación');await flush(p);await wait(200);
}
(async()=>{
 const browser=await (engine==='webkit'?webkit:chromium).launch(engine==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const srv=new Servidor();
 try{
  const A=await session(browser,srv,'A'),p=A.p;
  await flush(p);
  const days=await p.evaluate(()=>{
   const d=window.__T.dbg(),day=window.__T.fn.today(),earlier=window.__T.fn.plusMonths(day,-1),old=window.__T.fn.plusMonths(day,-2);
   const bank=d.banks[0]||{id:'recon-bank',name:'Banco Popular',color:'#1256a0'};if(!d.banks.length)d.banks.push(bank);
   const basis=[1570.17,1570.17,1570.17,1570.17,0,100,1570.17,100,1000,100,100];
   basis.forEach((opening,i)=>d.accounts.push({id:'recon-'+i,name:i===0?'Cuenta Digital':'Cuenta auditoría '+i,bankId:bank.id,kind:'savings',currency:i===7?'USD':'DOP',opening,opened:old,archived:false}));
   d.transactions.push({id:'recon-historical-deposit',type:'income',accountId:'recon-8',currency:'DOP',date:day,created:day+'T10:00:00Z',amount:300,note:'Ingreso de control',reviewed:true});
   window.__T.inv();window.__T.persist();return {day,earlier,old};
  });
  await flush(p);
  const initial=await totals(p),pairs=[[1500,-70.17],[2000,429.83],[1570.17,0],[0,-1570.17],[500,500],[99.99,-.01]];
  const fmt=(n,c='RD$')=>c+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  for(let i=0;i<pairs.length;i++){
   const [target,delta]=pairs[i],id='recon-'+i;
   const endingBefore=await ending(p);
   await enter(p,id,target);
   check('Saldo registrado '+i,await capture(p,'registered'),fmt([1570.17,1570.17,1570.17,1570.17,0,100][i]));
   check('Vista previa '+i,await capture(p,'after'),fmt(target));
   check('Diferencia exacta '+i,await capture(p,'delta'),delta===0?'Sin ajuste':(delta<0?'−':'+')+fmt(Math.abs(delta)));
   if(i===0){
    check('Teclado decimal nativo',await form(p).locator('[name=observed]').getAttribute('inputmode'),'decimal');
    check('Sin campos antiguos',/Aumentar|Disminuir|Personal\/Negocio|Guardar motivo|Tipo de operación/.test(await form(p).innerText()),false);
    await form(p).locator('h2').click();
    check('Confirmación visible sin scroll',await form(p).locator('.v-reconcile-submit').evaluate(b=>b.getBoundingClientRect().bottom<=innerHeight));
    await shot(p,'01-formulario');
    await form(p).locator('.v-reconcile-reason').click();
    check('Cinco motivos directos',await p.locator('.v-reconcile-reason-list button').count(),5);
    await shot(p,'02-motivos');
    await p.locator('[data-reason="2"]').click();
    check('Selector cerrado inmediatamente',await p.locator('.v-reconcile-reason-sheet').count(),0);
    check('Motivo seleccionado',await form(p).locator('.v-reconcile-reason strong').innerText(),'Ajuste bancario');
   }
   await confirm(p);
   check('Saldo conciliado '+i,await balance(p,id),target);
   const entries=await txs(p,id);check('Solo diferencia guardada '+i,entries.map(t=>t.amount),delta===0?[]:[delta]);
   if(entries.length){
    check('Sin cargos ni transferencia '+i,entries.every(t=>!t.paymentTax&&!t.paymentFee&&!t.toAccountId&&!t.category));
    check('Historial refleja saldo '+i,(await ledger(p,entries[0].id)).includes(fmt(target)));
   }
   check('Saldo de apertura intacto '+i,await p.evaluate(id=>window.__T.dbg().accounts.find(a=>a.id===id).opening,id),[1570.17,1570.17,1570.17,1570.17,0,100][i]);
   check('Ingresos/egresos intactos '+i,await totals(p),initial);
   check('Patrimonio cambia solo por la diferencia '+i,Math.round(((await ending(p))-endingBefore)*100),Math.round(delta*100));
   await clickAct(p,'closeModal');
  }
  await enter(p,'recon-6',1500);await confirm(p);await clickAct(p,'closeModal');
  await enter(p,'recon-6',1700);await confirm(p);await clickAct(p,'closeModal');
  check('Conciliaciones consecutivas', (await txs(p,'recon-6')).map(t=>t.amount),[-70.17,200]);
  check('Saldo consecutivo',await balance(p,'recon-6'),1700);
  await enter(p,'recon-7',99.99);check('Moneda y centavo USD',await capture(p,'delta'),'−US$0.01');await shot(p,'03-usd');
  await confirm(p);await clickAct(p,'closeModal');check('USD exacto',await balance(p,'recon-7'),99.99);
  check('Cuenta en moneda correcta',(await txs(p,'recon-7'))[0].currency,'USD');
  await enter(p,'recon-9',90);
  await form(p).locator('.v-reconcile-account').click();await p.locator('.v-reconcile-account-picker [data-value="recon-10"]').click();
  check('Cambio de cuenta limpia importe',await form(p).locator('[name=observed]').inputValue(),'');
  await form(p).locator('[name=observed]').fill('90,25');
  check('Coma decimal',await capture(p,'after'),'RD$90.25');
  await form(p).locator('button[type=submit]').evaluate(b=>{b.click();b.click()});
  await until(async()=>!(await form(p).count()),'doble toque');await flush(p);await clickAct(p,'closeModal');
  check('Una sola aplicación después de doble toque',(await txs(p,'recon-10')).map(t=>t.amount),[-9.75]);
  check('Cuenta abandonada intacta',await balance(p,'recon-9'),100);
  await enter(p,'recon-8',900,days.earlier);
  check('Saldo a fecha retroactiva',await capture(p,'registered'),'RD$1,000.00');check('Delta histórico',await capture(p,'delta'),'−RD$100.00');
  await shot(p,'04-retroactiva');await confirm(p);await clickAct(p,'closeModal');
  check('Saldo en fecha histórica',await balance(p,'recon-8',days.earlier),900);check('Movimiento posterior preservado',await balance(p,'recon-8'),1200);
  const edit=(await txs(p,'recon-8'))[0];
  await clickAct(p,'editTransaction',edit.id);await form(p).waitFor();
  check('Edición precarga saldo observado',await form(p).locator('[name=observed]').inputValue(),'900.00');
  await form(p).locator('[name=observed]').fill('950');await confirm(p);await clickAct(p,'closeModal');
  check('Edición mismo ID y delta recalculado',(await txs(p,'recon-8')).map(t=>[t.id,t.amount]),[[edit.id,-50]]);
  check('Fecha histórica editada',await balance(p,'recon-8',days.earlier),950);
  check('Saldo posterior editado',await balance(p,'recon-8'),1250);
  await clickAct(p,'deleteTransaction',edit.id);await p.locator('[data-act=v54ConfirmPermanent]').click();await p.locator('.v1011-ok').click();
  await until(async()=>!(await txs(p,'recon-8')).length,'eliminación del libro');await flush(p);
  check('Eliminación revierte solo diferencia',await balance(p,'recon-8'),1300);check('Eliminación persistida',(srv.doc().transactions||[]).some(t=>t.id===edit.id),false);
  // Verify persistence following a real reload and on another independent context.
  await p.reload({waitUntil:'load'});await until(async()=>(await sync(p)).active,'recarga');
  check('Saldo persistido tras recarga',await balance(p,'recon-6'),1700);
  const B=await session(browser,srv,'B',430,932);
  check('Sincronización en segundo dispositivo',await balance(B.p,'recon-6'),1700);
  await enter(B.p,'recon-6',1800);await confirm(B.p);await clickAct(B.p,'closeModal');
  await enter(p,'recon-6',1750); // A has stale preview until the revision check.
  await form(p).locator('button[type=submit]').click();
  await until(async()=>!(await form(p).count())||(await form(p).locator('.v-reconcile-error').isVisible()),'verificación remota');
  if(await form(p).count()){
   check('Saldo actualizado antes de confirmar',await capture(p,'registered'),'RD$1,800.00');await confirm(p);await clickAct(p,'closeModal');
  }
  check('Convergencia sin duplicar importe',await balance(p,'recon-6'),1750);
  check('Servidor: solo ajustes reales',(srv.doc().transactions||[]).filter(t=>t.type==='adjustment'&&t.accountId==='recon-6').map(t=>t.amount),[-70.17,200,100,-50]);
  check('Sin excepciones JavaScript',A.errors.concat(B.errors),[]);
  await B.ctx.close();await A.ctx.close();
  console.log('AUDITORÍA CONCILIACIÓN '+engine+': '+checks.length+' verificaciones aprobadas');
 }finally{fs.writeFileSync(path.join(dir,'resultados.json'),JSON.stringify(checks,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
