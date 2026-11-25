/* Centro Estratégico: cápsula de dos palabras -> reproductor inmersivo (prioridad de avisos y frases). */
const {chromium}=require('playwright');const open=require('./harness');const assert=require('assert');
(async()=>{const b=await chromium.launch();process.env.TOUCH='1';
for(const theme of ['light','black'])for(const w of [320,360,375,390,430]){
 process.env.THEME=theme;const {p}=await open(b,w,874);const tag=theme+'-'+w;
 await p.evaluate(()=>window.__T.go('wallet'));await p.waitForTimeout(350);
 await p.evaluate(()=>window.scrollTo(0,650));await p.waitForTimeout(450);
 const d=p.locator('.vive-mobile-dock');const center=p.locator('.vive-mobile-dock.is-compact [data-vsp-open]');
 assert.ok(await center.count(),tag+' cápsula visible');
 const title=await center.locator('.vdc-text strong').innerText();
 assert.strictEqual(title.trim().split(/\s+/).length,2,tag+' mensaje de dos palabras');
 assert.ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),tag+' sin scroll horizontal');
 await center.click();await p.waitForTimeout(300);
 let player=p.locator('#vive-strategic-player');assert.ok(await player.isVisible(),tag+' abre experiencia inmersiva');
 assert.ok(await player.locator('.vsp-art').isVisible(),tag+' arte visible');
 const details=player.locator('[data-vsp-detail]');
 if(await details.isVisible()){
  await details.click();await p.waitForTimeout(350);
  assert.strictEqual(await p.locator('#vive-strategic-player').count(),0,tag+' cerrar al ir al detalle');
 }else{
  await player.locator('[data-vsp-action="close"]').click();
 }
 await p.evaluate(()=>{const q=window.__T.dbg();q.cards=[];q.loans=[];q.personalLoans=[];q.recurring=[];q.transactions=[];window.__T.inv()});
 await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForTimeout(350);
 await p.evaluate(()=>window.scrollTo(0,650));await p.waitForTimeout(350);
 await p.locator('.vive-mobile-dock.is-compact [data-vsp-open]').click();await p.waitForTimeout(250);
 player=p.locator('#vive-strategic-player');assert.ok(await player.isVisible(),tag+' frase abre reproductor');
 await player.locator('[data-vsp-mode="joseo"]').click();
 assert.strictEqual(await player.getAttribute('data-mode'),'joseo',tag+' joseo');
 await player.locator('[data-vsp-mode="vive"]').click();
 assert.strictEqual(await player.getAttribute('data-mode'),'vive',tag+' frases');
 await player.locator('[data-vsp-action="close"]').click();
 assert.strictEqual(await p.locator('#vive-strategic-player').count(),0,tag+' cerrar frases');
 await p.close();
}
await b.close();console.log('centro-estrategico: OK');})().catch(e=>{console.error(e);process.exit(1)});
