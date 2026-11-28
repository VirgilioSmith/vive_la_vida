'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const open=require('./harness');
(async()=>{const b=await (process.env.WRAPPED_BROWSER==='webkit'?webkit:chromium).launch();
 try{for(const [w,h] of [[320,700],[390,844],[1440,900]]){const {ctx,p}=await open(b,w,h);try{
 await p.evaluate(()=>window.__T.go('overview'));
 await p.evaluate(()=>{window.ViveWrappedHost.events=()=>[];window.ViveWrappedHost.editorial=()=>({});window.ViveWrappedHost.special=()=>[];window.ViveWrappedHost.amounts=()=>({count:14,income:12000,expense:8200,net:3800,byCategory:{Comida:4200,Transporte:2600,Otros:1400}})});
 await p.locator('[data-vn-open]:visible').first().click();
 const bell=p.locator('.vn-dialog');await bell.locator('[data-vn-filter="wrapped"]').click();
 assert.equal(await bell.locator('.vw-archive [data-vwrapped]').count(),5);
 assert.equal(await bell.locator('[data-v216="report"]').count(),0);
 const fresh=await p.evaluate(()=>window.ViveWrappedEngine.schedule().fresh.length);
 assert.equal(await bell.locator('.vw-cover').count(),Math.max(1,fresh));
 const between=await p.evaluate(()=>{const E=window.ViveWrappedEngine,original=E.schedule;try{E.schedule=()=>original(new Date('2026-11-28T11:59:59Z'));const el=document.createElement('div');el.innerHTML=window.ViveWrapped.inbox();return {count:el.querySelectorAll('.vw-cover').length,label:el.querySelector('.vw-cover')?.textContent,archive:el.querySelectorAll('.vw-archive [data-vwrapped]').length}}finally{E.schedule=original}});
 assert.equal(between.count,1);assert.match(between.label,/Wrapped/);assert.doesNotMatch(between.label,/Estreno/);assert.equal(between.archive,5);
 await bell.locator('.vw-cover').first().click();await p.locator('dialog.vw-dialog').waitFor({state:'visible'});await p.locator('[data-vw-close]').click();await p.locator('dialog.vw-dialog').waitFor({state:'detached'});
 for(const kind of ['day','week','month','quarter','year']){
 const archive=bell.locator('.vw-archive');if(!await archive.evaluate(x=>x.open))await archive.locator('summary').click();
 await archive.locator('[data-vwrapped="'+kind+'"]').click();const d=p.locator('dialog.vw-dialog');
 await d.waitFor({state:'visible'});assert.equal(await d.getAttribute('data-kind'),kind);assert.ok(await d.locator('#vw-title').innerText());
 assert.equal(await d.getAttribute('data-scene'),'cover');
 const scenes=['cover'];for(let j=0;j<6;j++){await d.locator('[data-vw-next]').click();scenes.push(await d.getAttribute('data-scene'));assert.equal(await d.locator('.vw-story-copy').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);}
 assert.equal(new Set(scenes).size,7);assert.equal(scenes.at(-1),'final');
 await d.locator('[data-vw-older]').click();await d.locator('[data-vw-newer]').click();
 assert.equal(await d.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
 await d.locator('[data-vw-close]').click();await d.waitFor({state:'detached'});
 }
 }finally{await ctx.close()}}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
