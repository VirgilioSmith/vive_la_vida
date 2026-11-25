/* Centro Estratégico: el mensaje compacto abre reproductor visual, no navega por sorpresa. */
const {chromium}=require('playwright');const open=require('./harness');const assert=require('assert');
(async()=>{const browser=await chromium.launch();process.env.TOUCH='1';
for(const theme of ['light','black'])for(const width of [320,375,390,430]){
 process.env.THEME=theme;const {p}=await open(browser,width,844);
 await p.evaluate(()=>window.__T.go('wallet'));await p.waitForTimeout(250);
 await p.evaluate(()=>window.scrollTo(0,600));await p.waitForTimeout(250);
 const capsule=p.locator('.vive-mobile-dock.is-compact [data-vsp-open]');
 assert.ok(await capsule.count(),theme+' '+width+' centro presente');
 const title=await capsule.locator('.vdc-text strong').innerText();
 assert.equal(title.trim().split(/\s+/).length,2,'dos palabras: '+title);
 await capsule.click();
 const player=p.locator('#vive-strategic-player');
 assert.ok(await player.isVisible(),'reproductor visible');
 assert.equal(await player.locator('audio,video').count(),0,'no reproduce audio ni video');
 assert.ok(await player.locator('.vsp-art').isVisible(),'portada inmersiva');
 await player.locator('[data-vsp-mode="joseo"]').click();
 assert.equal(await player.getAttribute('data-mode'),'joseo','modo joseo');
 assert.ok((await player.locator('.vsp-message-title').innerText()).length>2,'frase joseo presente');
 await player.locator('[data-vsp-action="next"]').click();
 await player.locator('[data-vsp-action="toggle"]').click();
 assert.equal(await player.locator('[data-vsp-action="toggle"]').getAttribute('aria-label'),'Reanudar mensajes','pausa efectiva');
 await player.locator('[data-vsp-mode="vive"]').click();
 assert.equal(await player.getAttribute('data-mode'),'vive','modo Vive');
 await player.locator('[data-vsp-mode="day"]').click();
 assert.equal(await player.getAttribute('data-mode'),'day','modo financiero');
 await player.locator('[data-vsp-action="close"]').click();
 assert.equal(await p.locator('#vive-strategic-player').count(),0,'cierre');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'sin scroll horizontal');
 await p.close();
}
await browser.close();console.log('Centro Estratégico inmersivo: OK');})().catch(e=>{console.error(e);process.exit(1)});
