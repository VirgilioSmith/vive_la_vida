'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const open=require('./harness');
const evidence=process.env.APPEARANCE_VISUAL_DIR;
const go=(p,route)=>p.evaluate(route=>window.__T.go(route),route);
const style=(p,selector,prop)=>p.locator(selector).first().evaluate((el,prop)=>getComputedStyle(el)[prop],prop);
const token=(p,selector,name)=>p.locator(selector).first().evaluate((el,name)=>getComputedStyle(el).getPropertyValue(name).trim(),name);
const palettes=['coral','ocean','emerald','amber'];
async function checkSharedGlass(page,mobile){
 const surfaces=[
  ['income','.income-distribution'],
  ['expenses','.expenses-distribution'],
  ['register','.ledger-card'],
  mobile?['mobilehub','.v431-tile']:['overview','.ff-balance']
 ];
 for(const [route,selector] of surfaces){
  await go(page,route);
  assert.equal(await style(page,selector,'backdropFilter'),'blur(28px) saturate(1.4)',`${route}: shared glass`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${route}: page fits the viewport`);
 }
 if(mobile){
  await go(page,'wallet');
  const targets=await page.locator('.v68-wallet-dots button').evaluateAll(buttons=>buttons.map(button=>{
   const {width,height}=button.getBoundingClientRect();
   return Math.min(width,height);
  }));
  assert.ok(targets.length&&targets.every(size=>size>=24),'Wallet carousel: touch targets of at least 24px');
 }
}
async function themeMatrix(browser,width,mode){
 const mobile=width<791;
 process.env.THEME=mode;
 if(mobile)process.env.TOUCH='1';else delete process.env.TOUCH;
 const {ctx,p}=await open(browser,width,mobile?844:900);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  const seen={};let values;
  for(const palette of palettes){
   await p.evaluate(palette=>{const t=window.__T;t.dbg().settings.paletteChoice=palette;t.go('overview');},palette);
   const ambient=await style(p,'body','backgroundImage');
   assert.match(ambient,/radial-gradient/);assert.notEqual(ambient,seen.ambient);seen.ambient=ambient;
   for(const route of ['overview','banks','wallet',mobile?'mobilehub':'register']){
    await go(p,route);
    assert.equal(await style(p,'body','backgroundImage'),ambient,`${route}: same ambient`);
    assert.equal(await style(p,'main.main','backgroundImage'),'none',`${route}: no local gradient`);
    assert.equal(await style(p,'main.main','backgroundColor'),'rgba(0, 0, 0, 0)',`${route}: no opaque background`);
    if(route==='banks'||route==='wallet'){
     const root=route==='banks'?(mobile?'.vBanks-mobile':'.vBanksPc'):(mobile?'.v68-wallet':'.vWalletPc');
     await p.locator(root).waitFor();
     const targets=route==='banks'?(mobile?['.vBanks-mobile-hero','.vBanks-mobile-selector','.vBanks-mobile-tiles button svg']:['.vBanksPc-product-filter button[aria-pressed="true"]','.vBanksPc-stat-icon']):(mobile?['[aria-label="Seleccionar Créditos generales"] .v266-physical-card','.v266-wallet-actions button > span']:['.vWalletPc-stat.is-limit','.vWalletPc-product-mark.is-global','.vWalletPc-state-main .vWalletPc-ring']);
     for(const selector of targets){
      const colours=[await style(p,selector,'backgroundImage'),await style(p,selector,'backgroundColor'),await style(p,selector,'color')].join('|');
      assert.notEqual(colours,seen[selector],`${selector}: follows changing accent`);seen[selector]=colours;
     }
     const financial=route==='banks'?(mobile?'.vBanks-mobile-net strong':'.vBanksPc-metric strong'):(mobile?'.v565-primary strong':'.vWalletPc-stat strong');
     const amount=await p.locator(financial).first().innerText();
     const key=`${route}-${width}-${mode}`;values??={};if(values[key])assert.equal(amount,values[key]);else values[key]=amount;
     if(evidence)await p.screenshot({path:path.join(evidence,`${route}-${width}-${mode}-${palette}.png`),fullPage:true,animations:'disabled'});
     if(route==='banks'&&mobile){
      const sel=p.locator('.vBanks-mobile-selector'),colour=await style(p,'.vBanks-mobile-hero','backgroundImage');
      await sel.click();const picker=p.getByRole('dialog',{name:'Seleccionar institución'});await picker.locator('.v789-picker-row').nth(1).click();
      if(await picker.locator('.v789-picker-confirm').isVisible())await picker.locator('.v789-picker-confirm').click();
      assert.equal(await style(p,'.vBanks-mobile-hero','backgroundImage'),colour,'Selected bank retains user accent');
      await sel.click();await picker.locator('.v789-picker-row').first().click();if(await picker.locator('.v789-picker-confirm').isVisible())await picker.locator('.v789-picker-confirm').click();
     }
     if(route==='wallet'&&mobile){
      const control='.v266-wallet-actions button > span',colour=await style(p,control,'color');
      await p.locator('.v266-dots button').first().click();assert.equal(await style(p,control,'color'),colour,'Global credit retains user accent');
      if(evidence)await p.screenshot({path:path.join(evidence,`wallet-global-${width}-${mode}-${palette}.png`),fullPage:true,animations:'disabled'});
      await p.locator('.v266-dots button').nth(1).click();
     }
    }
   }
  }
  await checkSharedGlass(p,mobile);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
(async()=>{if(evidence)fs.mkdirSync(evidence,{recursive:true});const browser=await chromium.launch();try{for(const width of [320,390,1280,1672])for(const mode of ['light','black'])await themeMatrix(browser,width,mode);console.log('Dynamic appearance: 4 accents, 2 modes, 4 widths, four routes.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
