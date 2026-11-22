const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness');
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 try{
  process.env.TOUCH='1';
  const {p}=await open(b,390,844);
  const setup=await p.evaluate(()=>{
   const d=window.__T.dbg(),c=d.cards[0],a=d.accounts[0];
   const clone={...c,id:'test-adjustment',name:'Tarjeta conciliación',opened:'2020-01-01',openingDOP:1000,openingUSD:100,limitDOP:10000,limitUSD:1000,archived:false};
   d.cards.push(clone);window.__T.inv();
   return {account:a.id,bank:window.__T.fn.getAccountBalance(a),totals:window.__T.mt()};
  });
  const form=p.locator('#transactionForm');
  async function enter(){
   await p.evaluate(()=>{const btn=document.createElement('button');btn.dataset.act='otherAdjust';document.body.append(btn);btn.click();btn.remove();});
   await form.waitFor();await p.waitForTimeout(650);
   await form.locator('.v789-select-open').first().click();
   await p.locator('.v789-picker-row[data-value="card:test-adjustment"]').click();
   const confirm=p.locator('.v789-picker-confirm');assert.equal(await confirm.isEnabled(),true);assert.match(await confirm.innerText(),/Usar esta tarjeta/);
   await confirm.click();await p.waitForTimeout(100);
   assert.equal(await form.locator('[name=accountId]').inputValue(),'card:test-adjustment');
   assert.match(await form.locator('.v789-select-details').first().innerText(),/Tarjeta conciliación/);
  }
  for(const [currency,delta,expected] of [['DOP',250,1250],['USD',-25,75]]){
   await enter();
   await form.locator('[name=currency]').selectOption(currency);
   if(delta<0)await form.locator('[data-v768-sign=minus]').click();
   await form.locator('[name=amount]').fill(String(Math.abs(delta)));
   assert.equal(Number(await form.locator('[name=amount]').inputValue()),delta);
   await form.locator('.v857-reason-trigger').click();
   await form.locator('.v857-motive').selectOption({label:'Diferencia de saldo'});
   await form.locator('.v857-sheet-done').click();
   assert.match(await form.locator('.other-studio-impact').innerText(),new RegExp(expected.toLocaleString('en-US',{minimumFractionDigits:2}).replace(/[.,]/g,'\\$&')));
   await form.locator('button[type=submit]').click();
   await p.waitForTimeout(500);
   const state=await p.evaluate(({currency,account})=>{const d=window.__T.dbg();return {tx:d.transactions.filter(t=>t.cardId==='test-adjustment'&&t.currency===currency),status:window.__T.cs('test-adjustment',currency),bank:window.__T.fn.getAccountBalance(d.accounts.find(a=>a.id===account)),totals:window.__T.mt(),error:document.querySelector('#formError')?.textContent};},{currency,account:setup.account});
   assert.equal(state.tx.length,1,JSON.stringify(state.error));assert.equal(state.tx[0].type,'adjustment');assert.equal(state.tx[0].accountId,'');assert.equal(state.tx[0].amount,delta);assert.equal(state.status.debt,expected);assert.equal(state.bank,setup.bank);assert.equal(state.totals.income,setup.totals.income);assert.equal(state.totals.expense,setup.totals.expense);
   console.log(`OK ${currency}: ajuste ${delta}, deuda ${expected}, sin impacto en cuentas ni ingresos/gastos`);
  }
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
