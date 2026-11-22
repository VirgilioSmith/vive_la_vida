/* Regresión focalizada V1290. Ejecutar: node tests/tarjetas-v1290.js
   Requiere Playwright instalado y Chromium disponible. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness.js');
(async()=>{
 const browser=await chromium.launch();
 const problems=[];
 try{
  for(const [w,h] of [[1440,900],[390,844],[375,667],[360,640]]){
   if(w<=790)process.env.TOUCH='1';else delete process.env.TOUCH;
   let ctx;
   try{
    const session=await open(browser,w,h);ctx=session.ctx;const page=session.p;
    page.on('pageerror',e=>problems.push(`${w}x${h}: ${e.message}`));
    await page.evaluate(()=>window.__T.openCardForm());
    await page.waitForTimeout(700);
    const first=await page.evaluate(()=>{
     const f=document.querySelector('#cardForm'),grid=f?.querySelector('.form-grid'),more=f?.querySelector('#cardExtraDetails>summary'),next=f?.querySelector('.v1110-next');
     if(!f||!grid||!more||!next)return {missing:true};
     const r=more.getBoundingClientRect(),n=next.getBoundingClientRect();
     return {step:f.dataset.v1110Step,visible:r.top>=0&&r.bottom<=innerHeight,footer:n.top>=0&&n.bottom<=innerHeight,scroll:grid.scrollHeight>grid.clientHeight+3,moreText:more.textContent.trim()};
    });
    assert(!first.missing&&first.step==='0'&&first.visible&&first.footer&&!first.scroll&&first.moreText.includes('Más opciones'),`Primer paso ${w}x${h}: ${JSON.stringify(first)}`);
    await page.evaluate(()=>{
     const f=document.querySelector('#cardForm');
     f.elements.name.value='Tarjeta de prueba';
     const select=f.elements.bankId,option=[...select.options].find(x=>x.value);
     if(option){select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));}
    });
    await page.locator('#cardForm .v1110-next').click();
    await page.waitForTimeout(150);
    const second=await page.evaluate(()=>{
     const f=document.querySelector('#cardForm'),g=f.querySelector('.form-grid');
     return {step:f.dataset.v1110Step,scroll:g.scrollHeight>g.clientHeight+3,footer:(()=>{const b=f.querySelector('.v1110-next').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight})()};
    });
    assert(second.step==='1'&&!second.scroll&&second.footer,`Condiciones ${w}x${h}: ${JSON.stringify(second)}`);
    await page.locator('#cardForm .v1110-next').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#cardForm').getAttribute('data-v1110-step'),'2');
    await page.locator('#modal-root [data-act="closeModal"]').first().click();
    // En la ficha real de tarjeta, mantener Registrar pago y exponer Anualidad y seguros.
    await page.evaluate(()=>{
     const d=window.__T.dbg(),c=d.cards[0];if(!c)throw new Error('Falta tarjeta demo');
     const clone={...c,id:'v1290-test-'+innerWidth,name:'Tarjeta V1290',archived:false};
     d.cards.push(clone);window.__T.ui().cardId=clone.id;window.__T.go('cards');
    });
    assert.equal(await page.locator('.v1190-primary[data-act="payCard"]').count(),1);
    assert.equal(await page.locator('.v1290-secondary[data-act="annualFee"]').count(),1);
    await page.locator('.v1290-secondary[data-act="annualFee"]').click();
    await page.locator('#annualFeeForm [name="annualAmount"]').fill('5000');
    await page.locator('#annualFeeForm [name="insuranceAmount"]').fill('1200');
    const label=await page.locator('#v1290Total').innerText();
    const expected=await page.evaluate(()=>window.money(6200,'DOP',2));
    assert(label.includes(expected),`Total consolidado incorrecto: ${label}`);
    await page.locator('#annualFeeForm [type="submit"]').click();
    await page.waitForTimeout(250);
    const ledger=await page.evaluate(()=>{
     const d=window.__T.dbg(),c=d.cards.find(x=>x.name==='Tarjeta V1290'),rows=d.transactions.filter(t=>t.cardId===c.id&&t.v1290Batch);
     return {length:rows.length,amounts:rows.map(t=>t.amount).sort((a,b)=>a-b),kinds:rows.map(t=>t.chargeKind).sort(),sameBatch:rows.length===2&&rows[0].v1290Batch===rows[1].v1290Batch,summary:document.querySelector('.v1290-ledger')?.innerText||''};
    });
    assert(ledger.length===2&&ledger.sameBatch&&ledger.amounts[0]===1200&&ledger.amounts[1]===5000&&ledger.kinds.join(',')==='annual_fee,insurance',`Registro contable: ${JSON.stringify(ledger)}`);
    assert(ledger.summary.includes(expected),`Reporte no suma anualidad y seguro: ${ledger.summary}`);
    await page.locator('.v1290-secondary[data-act="annualFee"]').click();
    await page.locator('#annualFeeForm [name="annualAmount"]').fill('5000');
    await page.locator('#annualFeeForm [name="insuranceAmount"]').fill('0');
    await page.locator('#annualFeeForm [type="submit"]').click();
    await page.waitForTimeout(100);
    const duplicates=await page.evaluate(()=>{
     const d=window.__T.dbg(),c=d.cards.find(x=>x.name==='Tarjeta V1290');
     return {count:d.transactions.filter(t=>t.cardId===c.id&&t.chargeKind==='annual_fee').length,error:document.querySelector('#annualFeeForm #formError')?.textContent||''};
    });
    assert(duplicates.count===1&&/anualidad.*existe/i.test(duplicates.error),`Duplicado permitido: ${JSON.stringify(duplicates)}`);
    console.log(`OK: ${w}x${h} formulario y cargos`);
   }catch(e){problems.push(`${w}x${h}: ${e.stack||e.message}`);}finally{if(ctx)await ctx.close();}
  }
 }finally{await browser.close()}
 if(problems.length){console.error(problems.join('\n'));process.exitCode=1}
 else console.log('OK: V1290 tarjetas — sin desbordes, registro y total verificados');
})().catch(e=>{console.error(e);process.exitCode=1});
