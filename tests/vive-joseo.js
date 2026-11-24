'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness');
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [1440,390]){
   const {ctx,p}=await open(browser,width,width===390?844:900);
   try{
    await p.evaluate(()=>{localStorage.removeItem('vive.mode.v1');localStorage.removeItem('vive.seenj.v1');window.ViveModule.open()});
    const reader=p.locator('#vive-reader');
    await reader.locator('[data-vive-mode="joseo"]').click();
    assert.equal(await reader.locator('[data-vive-mode="joseo"]').getAttribute('aria-pressed'),'true');
    const seen=new Set();
    for(let i=0;i<12;i++){
     assert.equal(await reader.locator('.vive-reader-category').innerText(),'Joseo');
     const phrase=await reader.locator('.vive-reader-copy').innerText();
     assert.ok(phrase.trim(),'Frase vacía');
     seen.add(phrase);
     await reader.locator('[data-vive-next]').click();
    }
    assert.ok(seen.size>=10,'Variedad de frases Joseo');
    await reader.locator('[data-vive-mode="vive"]').click();
    assert.equal(await reader.locator('[data-vive-mode="vive"]').getAttribute('aria-pressed'),'true');
    assert.ok(['Bienestar y salud','Joseo'].includes(await reader.locator('.vive-reader-category').innerText()));
    assert.equal(await p.evaluate(()=>localStorage.getItem('vive.mode.v1')),'vive');
   }finally{await ctx.close()}
  }
  console.log('Vive/Joseo: categorías y selector verificados.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
