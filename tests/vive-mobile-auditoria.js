/* Auditoría móvil Vive · Playwright sobre el arnés local con datos demo y Supabase simulado.
   Nunca usa credenciales ni datos de producción. node tests/vive-mobile-auditoria.js */
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness.js');
const fs=require('node:fs'),path=require('node:path');
const screenshotDir=path.resolve(__dirname,'../test-results/vive-mobile');
fs.mkdirSync(screenshotDir,{recursive:true});
const shot=(p,name)=>p.screenshot({path:path.join(screenshotDir,name+'.png'),fullPage:false});
const checks=[];
function check(label,actual,expected=true){assert.deepEqual(actual,expected,label);checks.push(label);console.log('✓ '+label)}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function showQuick(p){await p.evaluate(()=>{const b=document.createElement('button');b.dataset.act='newTransaction';b.dataset.type='expense';document.body.append(b);b.click();b.remove()})}
async function fastOpen(p){await p.evaluate(()=>{const b=document.createElement('button');b.dataset.v354Act='open';document.body.append(b);b.click();b.remove()})}
async function chooseNewContact(p,first,last){
 await p.locator('[data-v354-act=pickPerson]').click();
 check('Selector de contactos visible',await p.locator('#v354-person-search').count(),1);
 await shot(p,'selector-contactos');
 await p.locator('[data-v354-act="newPerson"]').click();
 check('Crear contacto sin perder compra',await p.locator('#v354-new-person').count(),1);
 await p.locator('#v354-new-person [name=firstName]').fill(first);
 await p.locator('#v354-new-person [name=lastName]').fill(last);
 await p.locator('#v354-new-person').evaluate(f=>f.requestSubmit());
 check('Contacto seleccionado',await p.locator('#v354-form [name=person]').inputValue(),first+' '+last);
}
async function thirdParty(p,purchase,received,mode,paidAmount,first,source='card'){
 await fastOpen(p);
 check('Formulario Movimiento rápido',await p.locator('#v354-form').count(),1);
 await chooseNewContact(p,first,'Prueba');
 if(source==='account'){
  await p.locator('[data-v354-act=pickPurchase]').click();
  const accountOption=p.locator('.v789-picker-row[data-kind=account]').first();
  check('Cuenta disponible en selector universal',await accountOption.count(),1);
  await accountOption.click();
  await p.locator('.v789-picker-confirm').click();
  check('Compra desde cuenta seleccionada',await p.locator('#v354-form [name=purchaseSource]').inputValue(),'account');
 }
 await p.locator('#v354-form [name=purchase]').fill(String(purchase));
 await p.locator('#v354-form [name=received]').fill(String(received));
 await p.locator('[data-v354-act=pickReceipt]').click();
 await p.locator('[data-v354-act=chooseReceipt][data-id="'+mode+'"]').click();
 await p.locator('#v354-form [name=channel]').selectOption('presencial');
 if(mode==='account_and_paid')await p.locator('#v354-form [name=paidAmount]').fill(String(paidAmount));
 check('Avance del saldo pendiente',await p.locator('#v354-owed-preview').innerText().then(v=>v.includes(String(Math.abs(purchase-received)))),true);
 await p.locator('#v354-form').evaluate(f=>f.requestSubmit());
 check('Confirmación financiera',await p.locator('[data-v354-act=confirm]').count(),1);
 const reviewTitle=await p.locator('.v355-review-hero').innerText();
 console.log('REVISIÓN '+first+': '+JSON.stringify(reviewTitle));
 await shot(p,'confirmacion-'+first);
 if(received>purchase)check('Sobrante como dinero por devolver',reviewTitle.toLocaleLowerCase('es').includes('por devolver'),true);
 await p.locator('[data-v354-act=confirm]').click();
 await sleep(300);
 return p.evaluate(name=>{
  const d=window.__T.dbg(),rels=d.personalLoans.filter(l=>l.person===name+' Prueba'&&String(l.source||'').startsWith('third_party_'));
  const ids=new Set(rels.map(l=>l.id));
  const tx=d.transactions.filter(t=>ids.has(t.personalLoanId)||ids.has(t.thirdPartyRelationId));
  return {rels:rels.map(l=>({direction:l.direction,principal:l.principal,source:l.source})),tx:tx.map(t=>({type:t.type,amount:t.amount,principal:t.principal,accountId:t.accountId,cardId:t.cardId})),contacts:d.personalContacts.filter(c=>c.firstName===name&&c.lastName==='Prueba').length};
 },first);
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [w,h] of [[375,667],[390,844],[430,932]]){
   process.env.TOUCH='1';
   const {ctx,p}=await open(browser,w,h);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.evaluate(()=>{const d=window.__T.dbg();d.hiddenTaxonomy=d.hiddenTaxonomy||{};d.hiddenTaxonomy.categories=d.hiddenTaxonomy.categories||[];d.hiddenTaxonomy.categories.push({kind:'gasto',name:'Transporte'});window.__T.go('categories')});
    check('Categoría oculta fuera del catálogo '+w,await p.evaluate(()=>window.__T.cats('gasto').includes('Transporte')),false);
    await showQuick(p);await sleep(300);
    check('Teclado HTML eliminado '+w,await p.locator('.mqr-keypad,.v749-keypad').count(),0);
    const amount=p.locator('#v749Amount,#mqrAmountInput').first();
    check('Importe numérico nativo '+w,await amount.getAttribute('inputmode'),'decimal');
    await amount.fill('2500,75');
    check('Admite coma decimal '+w,await amount.inputValue(),'2500.75');
    check('No ofrece categoría eliminada '+w,await p.locator('[data-v749=quick][data-value=Transporte],[data-mqr-act=preset][data-id=Transporte]').count(),0);
    await shot(p,'nuevo-movimiento-'+w);
    check('Sin error de JavaScript '+w,errors.length,0);
    if(w===390){
     const r1=await thirdParty(p,400,500,'account',0,'AnaVive');
     check('Sobrante contabilizado como cuenta por pagar',r1.rels.some(l=>l.direction==='borrowed'&&l.principal===100));
     check('Solo una cuenta por cobrar original',r1.rels.filter(l=>l.direction==='lent'&&l.principal===400).length,1);
     check('Sin ingreso o gasto ficticio',r1.tx.some(t=>t.type==='income'||t.type==='expense'),false);
     check('Contacto creado una sola vez',r1.contacts,1);
     const r2=await thirdParty(p,800,500,'account_and_paid',150,'PedroVive');
     check('Faltante por cobrar RD$300',r2.rels.some(l=>l.direction==='lent'&&l.principal===800));
     check('Pago real a tarjeta RD$150',r2.tx.filter(t=>t.type==='card_payment').map(t=>t.amount),[150]);
     check('Sin segunda cuenta por pagar',r2.rels.some(l=>l.direction==='borrowed'),false);
     const r3=await thirdParty(p,800,500,'account',0,'MartaVive','account');
     check('Compra desde cuenta crea obligación por cobrar',r3.rels.some(l=>l.direction==='lent'&&l.principal===800));
     check('Cargo patrimonial exclusivo a cuenta',r3.tx.some(t=>t.type==='personal_issue'&&t.amount===800&&!!t.accountId&&!t.cardId));
    }
   }finally{await ctx.close()}
  }
  console.log('AUDITORÍA MÓVIL: '+checks.length+' verificaciones aprobadas');
 }finally{await browser.close()}
})().catch(e=>{console.error('✕',e?.stack||e);process.exitCode=1});
