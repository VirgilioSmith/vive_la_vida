/* VIVE Intelligence — integridad de datos: sin doble contabilización, multimoneda, correcciones retroactivas (app real). */
const {chromium}=require('playwright');const open=require('./harness.js');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,400))}};
(async()=>{const b=await chromium.launch();const errs=[];const {p}=await open(b,390,844);p.on('pageerror',e=>errs.push(e.message));let sup=0;p.on('request',q=>{if(/supabase\.co\/(rest|functions)/.test(q.url())&&/intellig/i.test(q.url()))sup++});
 await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(1200);
 const r=await p.evaluate(()=>{const t=today();const acc=db.accounts.find(a=>a.currency==='DOP'),card=db.cards[0];const id=()=>Math.random().toString(36).slice(2);const fx=Number(db.settings.fx)||60;
  db.transactions=[
   {id:id(),type:'expense',date:t,amount:1000,currency:'DOP',accountId:acc.id,category:'Comida',note:'a',reviewed:true},
   {id:id(),type:'card_charge',date:t,amount:2000,currency:'DOP',cardId:card.id,category:'Ocio',note:'b',reviewed:true},
   {id:id(),type:'card_payment',date:t,amount:5000,currency:'DOP',cardId:card.id,accountId:acc.id,reviewed:true},
   {id:id(),type:'transfer',date:t,amount:3000,currency:'DOP',accountId:acc.id,toAccountId:(db.accounts.find(x=>x.id!==acc.id)||acc).id,targetAmount:3000,reviewed:true},
   {id:id(),type:'card_advance',date:t,amount:4000,currency:'DOP',cardId:card.id,accountId:acc.id,reviewed:true},
   {id:id(),type:'card_refund',date:t,amount:500,currency:'DOP',cardId:card.id,reviewed:true},
   {id:id(),type:'income',date:t,amount:20000,currency:'DOP',accountId:acc.id,category:'Salario',note:'n',reviewed:true},
   {id:id(),type:'expense',date:t,amount:10,currency:'USD',accountId:(db.accounts.find(x=>x.currency==='USD')||acc).id,category:'Comida',note:'usd',reviewed:true}];
  window.__viveIntel.invalidate();const L=window.__viveIntel.snapshot().ledger;
  return {fx,x:L.filter(e=>e.k==='x').map(e=>[e.a,e.p,e.l]),i:L.filter(e=>e.k==='i').map(e=>e.a),n:L.length}});
 const xs=r.x.map(e=>Math.round(e[0]));
 check('pago de tarjeta, transferencia y avance de efectivo NO entran como gasto ni ingreso',!xs.includes(5000)&&!xs.includes(3000)&&!xs.includes(4000)&&!r.i.includes(5000)&&!r.i.includes(3000)&&!r.i.includes(4000),r);
 check('el consumo con tarjeta y el gasto directo sí cuentan (una sola vez)',xs.includes(1000)&&xs.includes(2000)&&xs.filter(a=>a===2000).length===1,xs);
 check('la devolución resta del consumo (no es un ingreso recurrente)',xs.includes(-500)&&!r.i.includes(500),r);
 check('el ingreso real cuenta una vez',r.i.filter(a=>a===20000).length===1,r.i);
 check('multimoneda: el USD se convierte con la tasa configurada (no se suma como pesos)',xs.some(a=>a===Math.round(10*r.fx))&&!xs.includes(10),{fx:r.fx,xs});
 /* corrección retroactiva: la memoria derivada se recalcula con el dato corregido */
 const c=await p.evaluate(()=>{const tx=db.transactions.find(x=>x.type==='expense'&&x.note==='a');tx.amount=1700;window.__viveIntel.invalidate();const L=window.__viveIntel.snapshot().ledger;return L.filter(e=>e.k==='x').some(e=>Math.round(e.a)===1700)&&!L.some(e=>Math.round(e.a)===1000&&e.p==='a'&&e.l==='a')});
 check('corrección retroactiva: al editar un movimiento el análisis lo refleja (sin copias obsoletas)',c);
 const d=await p.evaluate(()=>{const tx=db.transactions.find(x=>x.type==='expense'&&x.note==='a');db.transactions=db.transactions.filter(x=>x!==tx);window.__viveIntel.invalidate();return window.__viveIntel.snapshot().ledger.some(e=>e.l==='a')});
 check('eliminación retroactiva: un movimiento eliminado desaparece del análisis',d===false);
 const q=await p.evaluate(()=>{const t=today();const acc=db.accounts[0];db.transactions.push({id:'p1',type:'expense',date:t,amount:777,currency:'DOP',accountId:acc.id,note:'pend',pendingStatus:'pending'});window.__viveIntel.invalidate();return window.__viveIntel.snapshot().ledger.some(e=>e.l==='pend')});
 check('un movimiento pendiente no se interpreta como comportamiento real',q===false);
 const nets=await p.evaluate(async()=>{const n=performance.getEntriesByType('resource').filter(e=>/intellig/i.test(e.name)&&/supabase/.test(e.name)).length;return n});
 check('el análisis no consulta Supabase (cálculo local)',sup===0&&nets===0,{sup,nets});
 check('sin errores de página',errs.length===0,errs);
 console.log(`\nINTELLIGENCE INTEGRIDAD: ${ok} verificaciones aprobadas${bad?`, ${bad} FALLARON`:''}`);await b.close();process.exit(bad?1:0)})();
