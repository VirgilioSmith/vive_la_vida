/* Playwright: real mobile UI, controlled balances and relational server persistence. */
'use strict';
process.env.NOBOOT='1';process.env.MOCKFILE='mock-servidor.js';process.env.TOUCH='1';process.env.MOVEMENTS_AUDIT='1';
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const open=require('./harness'),{Servidor}=require('./lib-servidor');
const engine=process.env.MOVEMENTS_BROWSER||'chromium',dir=path.resolve(__dirname,'../test-results/movimientos',engine);fs.mkdirSync(dir,{recursive:true});
const checks=[];const check=(label,actual,expected=true)=>{assert.deepEqual(actual,expected,label);checks.push({label,actual});console.log('✓ '+label)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<80;i++){if(await fn())return;await wait(250)}throw Error('Tiempo agotado: '+label)}
const sync=p=>p.evaluate(()=>window.__T.sync());
async function flush(p){await until(async()=>{let s=await sync(p);if(s.dirty&&!s.saving&&!s.conflict)await p.evaluate(()=>{window.__T.unbackoff();return window.__T.flush()});s=await sync(p);return s.active&&!s.dirty&&!s.saving&&!s.conflict},'guardado confirmado')}
const shot=async(p,name)=>{await p.waitForTimeout(650);await p.screenshot({path:path.join(dir,name+'.png'),animations:'disabled'})};
const quick=p=>p.locator('#v354-form');
const action=(p,key)=>p.evaluate(key=>{const b=document.createElement('button');b.dataset.v354Act=key;document.body.append(b);b.click();b.remove()},key);
const total=p=>p.evaluate(()=>{const m=window.__T.mt();return [m.income,m.expense]});
const state=p=>p.evaluate(()=>{let T=window.__T,d=T.dbg();return {source:T.fn.getAccountBalance(d.accounts.find(a=>a.id==='audit-source')),receiver:T.fn.getAccountBalance(d.accounts.find(a=>a.id==='audit-receiver')),debt:T.cs('audit-card','DOP').debt}});
const cents=n=>Math.round(n*100);
async function chooseProduct(p,id){await p.locator('.v789-picker-row[data-value="'+id+'"]').click();await p.locator('.v789-picker-confirm').click()}
async function scenario(p,s,i,srv){
 const before=await state(p),totals=await total(p),name='Prueba'+i;
 await action(p,'open');await quick(p).waitFor();
 await p.locator('[data-v354-act=pickPerson]').click();if(i===0)await shot(p,'04-contactos');
 await p.locator('[data-v354-act=newPerson]').click();if(i===0)await shot(p,'05-nuevo-contacto');
 await p.locator('#v354-new-person [name=firstName]').fill(name);await p.locator('#v354-new-person [name=lastName]').fill('Persona');
 await p.locator('button[form=v354-new-person]').click();
 check('Contacto elegido '+i,await quick(p).locator('[name=person]').inputValue(),name+' Persona');
 await p.locator('[data-v354-act=pickPurchase]').click();await chooseProduct(p,s.source==='account'?'audit-source':'audit-card');
 await quick(p).locator('[name=purchase]').fill(String(s.p));await quick(p).locator('[name=received]').fill(String(s.r));
 check('Teclado decimal '+i,await quick(p).locator('[name=purchase]').getAttribute('inputmode'),'decimal');
 if(i===0)await shot(p,'03-compra');
 await p.locator('[data-v354-act=pickReceipt]').click();if(i===0){check('Cuatro situaciones del dinero',await p.locator('[data-v354-act=chooseReceipt]').count(),4);await shot(p,'06-destino-dinero')}
 await p.locator('[data-v354-act=chooseReceipt][data-id="'+s.mode+'"]').click();
 if(['account','account_and_paid'].includes(s.mode)){
  await p.locator('#v354-account-label .v789-select-open').click();await chooseProduct(p,'audit-receiver');
 }
 if(s.mode==='account_and_paid')await quick(p).locator('[name=paidAmount]').fill(String(s.paid));
 await quick(p).locator('[name=channel]').selectOption(i===0?'internet':'presencial');
 if(i===0){await shot(p,'07-formulario-compra');check('Pendiente exacto',await p.locator('#v354-owed-preview').innerText(),'RD$5,106.00')}
 await p.locator('button[form=v354-form]').click();await p.locator('[data-v354-act=confirm]').waitFor();
 if(i===0){await shot(p,'08-confirma-compra');const t=await p.locator('.vQuick-review').innerText();check('Vista previa muestra tres efectos', ['5,656.00','550.00','5,106.00','1.10'].every(x=>t.includes(x)))}
 // Same browser session for every case: specifically detects the former processing lock.
 await p.locator('[data-v354-act=confirm]').evaluate(b=>{b.click();b.click()});
 await until(async()=>!(await p.locator('[data-v354-act=confirm]').count()),'cierre confirmación '+i);await flush(p);
 const data=await p.evaluate(name=>{const T=window.__T,d=T.dbg(),rels=d.personalLoans.filter(l=>l.person===name+' Persona'),ids=rels.map(l=>l.id);return {rels:rels.map(l=>({id:l.id,direction:l.direction,balance:T.personal(l.id)})),tx:d.transactions.filter(t=>ids.includes(t.personalLoanId)||ids.includes(t.thirdPartyRelationId)),contacts:d.personalContacts.filter(c=>c.firstName===name).length}},name);
 const due=Math.max(0,cents(s.p-s.r)),surplus=Math.max(0,cents(s.r-s.p)),paid=s.paid||0;
 check('Cuenta por cobrar real '+i,cents(data.rels.find(l=>l.direction==='lent')?.balance),due);
 check('Sobrante por pagar '+i,cents(data.rels.find(l=>l.direction==='borrowed')?.balance||0),surplus);
 check('Relaciones sin duplicar '+i,data.rels.length,surplus?2:1);
 check('Contacto único '+i,data.contacts,1);
 check('Sin ingreso/egreso ordinario '+i,await total(p),totals);
 check('Tipos exclusivamente patrimoniales '+i,data.tx.every(t=>['personal_issue','personal_settlement','card_payment'].includes(t.type)&&!t.paymentTax&&!t.paymentFee));
 check('Cantidad exacta de movimientos '+i,data.tx.length,1+(s.r>0?1:0)+(surplus>0?1:0)+(s.mode==='account_and_paid'?1:0));
 const after=await state(p);
 check('Variación cuenta origen '+i,cents(after.source-before.source),s.source==='account'?-cents(s.p):0);
 check('Variación cuenta receptora '+i,cents(after.receiver-before.receiver),['account','account_and_paid'].includes(s.mode)?cents(s.r-paid):0);
 check('Variación deuda tarjeta '+i,cents(after.debt-before.debt),s.source==='account'?0:cents(s.p-(s.mode==='card'?s.r:paid)));
 check('Transacciones realmente persistidas '+i,data.tx.every(t=>srv.doc().transactions.some(x=>x.id===t.id)));
 return data;
}
(async()=>{const browser=await (engine==='webkit'?webkit:chromium).launch();const srv=new Servidor();let ctx;
 try{
  const session=await open(browser,390,844,c=>c.exposeFunction('__srv',(op,payload)=>op==='rpc'?srv.rpc(payload,'A'):srv.read(payload)));ctx=session.ctx;const p=session.p;const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await until(async()=>(await sync(p)).active,'sesión');await flush(p);
  await p.evaluate(()=>{const T=window.__T,d=T.dbg(),old=T.fn.plusMonths(T.fn.today(),-1);d.banks.push({id:'audit-bank',name:'Banco Popular',archived:false});for(const [id,name] of [['audit-source','Cuenta origen'],['audit-receiver','Cuenta Digital']])d.accounts.push({id,name,bankId:'audit-bank',kind:'checking',currency:'DOP',opening:50000,opened:old,archived:false});d.cards.push({id:'audit-card',name:'Visa Titanium Popular',bankId:'audit-bank',network:'visa',limitDOP:150000,limitUSD:1000,openingDOP:10000,openingUSD:0,opened:old,cutDay:20,dueDay:15,archived:false});T.inv();T.persist()});await flush(p);
  // Ordinary movement: exact mobile structure and actual native form submission.
  await p.evaluate(()=>{const b=document.createElement('button');b.dataset.act='newTransaction';b.dataset.type='income';document.body.append(b);b.click();b.remove()});
  await p.locator('[data-v749=mode][data-value=income]').click();await p.locator('[data-v749=source]').click();await chooseProduct(p,'audit-receiver');
  await p.locator('#v749Amount').fill('2500,00');check('Importe nativo ingreso',await p.locator('#v749Amount').getAttribute('inputmode'),'decimal');
  check('Tres accesos rápidos',await p.locator('[data-v749=quick]').count(),3);check('Campos redundantes eliminados',await p.locator('.v749-fieldline [data-v749=category],.v749-fieldline [data-v749=subcategory],#v749Date').count(),0);
  await shot(p,'01-nuevo-movimiento');const before=await state(p);await p.locator('[data-v749=continue]').click();await p.locator('[data-v749=confirm]').waitFor();check('Sin bloque duplicado de instrumentos',await p.locator('.v749-review-overlay .v1295-confirm-products').count(),0);await shot(p,'02-confirma-movimiento');await p.locator('[data-v749=confirm]').click();await until(async()=>!(await p.locator('[data-v749=confirm]').count()),'ingreso confirmado');await flush(p);check('Ingreso real guardado',cents((await state(p)).receiver-before.receiver),250000);
  await p.locator('#v156-feedback-layer').waitFor({state:'detached'});
  // Confirm expense and own-account transfer through the same actual native save path.
  async function regular(mode,source,destination,amount){
   await p.evaluate(mode=>{const b=document.createElement('button');b.dataset.act='newTransaction';b.dataset.type=mode;document.body.append(b);b.click();b.remove()},mode);
   await p.locator('[data-v749=mode][data-value="'+(mode==='expense'?'spend':mode)+'"]').click();await p.locator('[data-v749=source]').click();await chooseProduct(p,source);
   if(destination){await p.locator('[data-v749=destination]').click();await chooseProduct(p,destination)}
   await p.locator('#v749Amount').fill(String(amount));await p.locator('[data-v749=continue]').click();await p.locator('[data-v749=confirm]').click();await until(async()=>!(await p.locator('[data-v749=confirm]').count()),mode+' confirmado');await flush(p);await p.locator('#v156-feedback-layer').waitFor({state:'detached'});
  }
  let baseline=await state(p);await regular('expense','audit-card',null,125.75);check('Gasto real en tarjeta',cents((await state(p)).debt-baseline.debt),12575);
  baseline=await state(p);await regular('expense','audit-source',null,78.42);check('Gasto real desde cuenta',cents(baseline.source-(await state(p)).source),7842);
  baseline=await state(p);await regular('transfer','audit-source','audit-receiver',123.45);check('Transferencia real al destino',cents((await state(p)).receiver-baseline.receiver),12345);check('Transferencia con débito único',cents(baseline.source-(await state(p)).source),cents(123.45+await p.evaluate(()=>{const t=window.__T.dbg().transactions.filter(x=>x.type==='transfer'&&x.accountId==='audit-source').at(-1);return Number(t.transferFee||0)})));
  const scenarios=[{p:5656,r:550,mode:'account'},{p:5656,r:550,mode:'card'},{p:5656,r:550,mode:'account_and_paid',paid:200},{p:5656,r:0,mode:'none'},{p:5656,r:5656,mode:'account'},{p:5656,r:6000,mode:'account'},{p:5656,r:550,mode:'account',source:'account'},{p:99.99,r:.01,mode:'account'},{p:100,r:150,mode:'card'}];
  const all=[];for(let i=0;i<scenarios.length;i++)all.push(await scenario(p,scenarios[i],i,srv));
  const final=await state(p);await p.reload({waitUntil:'load'});await until(async()=>(await sync(p)).active,'recarga');check('Saldos persistentes tras recargar',await state(p),final);
  check('Todos los movimientos siguen en historial tras recarga',await p.evaluate(ids=>ids.every(id=>window.__T.dbg().transactions.some(t=>t.id===id)),all.flatMap(a=>a.tx.map(t=>t.id))));
  check('Entre personas conserva todos los saldos',await p.evaluate(rels=>rels.every(r=>window.__T.personal(r.id)===r.balance),all.flatMap(a=>a.rels)));
  await p.evaluate(()=>window.__T.go('register'));await shot(p,'09-historial');check('Sin excepciones JavaScript',errors,[]);
  console.log('AUDITORÍA MOVIMIENTOS '+engine+': '+checks.length+' verificaciones aprobadas');
 }finally{fs.writeFileSync(path.join(dir,'resultados.json'),JSON.stringify(checks,null,2));if(ctx)await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
