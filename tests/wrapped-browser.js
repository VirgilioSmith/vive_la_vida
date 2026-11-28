'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const open=require('./harness');
(async()=>{const b=await (process.env.WRAPPED_BROWSER==='webkit'?webkit:chromium).launch();
 try{for(const [w,h] of [[390,844],[1440,900]]){const {ctx,p}=await open(b,w,h);try{
 await p.evaluate(()=>window.__T.go('overview'));
 const bell=p.locator('.v36-notifications:visible').first();await bell.locator('summary').first().click();
 assert.equal(await bell.locator('[data-vwrapped]').count(),5);
 assert.equal(await bell.locator('[data-v216="report"]').count(),0);
 await bell.locator('[data-vwrapped="day"]').click();const d=p.locator('dialog.vw-dialog');
 await d.waitFor({state:'visible'});assert.ok(await d.locator('#vw-title').innerText());
 await d.locator('[data-vw-older]').click();await d.locator('[data-vw-newer]').click();
 assert.equal(await d.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
 await d.locator('[data-vw-close]').click();await d.waitFor({state:'detached'});
 }finally{await ctx.close()}}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
