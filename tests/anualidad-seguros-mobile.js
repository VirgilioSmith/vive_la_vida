/* V1300 · Anualidad y seguro: validación visual y no destructiva.
   Uso: ANNUAL_BROWSER=chromium|webkit node tests/anualidad-seguros-mobile.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const open = require('./harness');
const engine = process.env.ANNUAL_BROWSER === 'webkit' ? webkit : chromium;
const browserName = process.env.ANNUAL_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const output = path.resolve(__dirname, '../test-results/anualidad-seguros');
fs.mkdirSync(output, { recursive: true });
const results = [];

(async () => {
  const browser = await engine.launch({ headless:true });
  try {
    for (const theme of ['light', 'black']) {
      for (const [w,h] of [[375,667],[390,844],[430,932]]) {
        process.env.TOUCH = '1';
        process.env.THEME = theme;
        const { ctx, p } = await open(browser,w,h);
        const errors = [];
        p.on('pageerror', e => errors.push(e.message));
        try {
          await p.evaluate(() => window.__T.go('wallet'));
          const card = p.locator('.v266-wallet-actions [data-act="goCard"]');
          await card.waitFor({state:'visible'});
          await card.click();
          const openAnnual = p.locator('#app [data-act="annualFee"]').first();
          await openAnnual.waitFor({state:'visible'});
          await openAnnual.click();
          const form = p.locator('#annualFeeForm');
          await form.waitFor({state:'visible'});
          assert.equal(await form.locator('.v1300-charge-card').count(),2);
          assert.equal(await form.locator('.v1300-date-card').count(),1);
          assert.equal(await form.locator('#v1290Total').count(),1);
          for(const name of ['cardId','annualAmount','annualCurrency','insuranceAmount','insuranceCurrency','date'])
            assert.equal(await form.locator('[name="'+name+'"]').count(),1,'Campo '+name);
          const annual = form.locator('[name="annualAmount"]');
          const insurance = form.locator('[name="insuranceAmount"]');
          assert.equal(await annual.getAttribute('inputmode'),'decimal');
          assert.equal(await insurance.getAttribute('inputmode'),'decimal');
          await annual.fill('2500.50');
          await form.locator('[name="annualCurrency"]').selectOption('DOP');
          await insurance.fill('125.25');
          await form.locator('[name="insuranceCurrency"]').selectOption('USD');
          assert.equal(await annual.inputValue(),'2500.50');
          assert.equal(await insurance.inputValue(),'125.25');
          const summary = form.locator('#v1290Total');
          assert.equal(await summary.locator('strong span').count(),2,'Dos monedas separadas');
          assert.match(await summary.innerText(),/RD\$/);
          assert.match(await summary.innerText(),/US\$/);
          const layout = await p.evaluate(() => {
            const dlg=document.querySelector('.modal[data-v204-form="annualFeeForm"]');
            const form=document.querySelector('#annualFeeForm');
            const footer=form.querySelector('.form-foot');
            const cards=[...form.querySelectorAll('.v1300-charge-card')];
            const rect=e=>e.getBoundingClientRect();
            const styles=getComputedStyle(dlg);
            return { bg:styles.backgroundColor,modalWidth:rect(dlg).width,
              footerVisible:rect(footer).height>40 && rect(footer).bottom<=innerHeight+3,
              noOverflow:dlg.scrollWidth<=dlg.clientWidth+2,
              cardsEqual:cards.length===2 && Math.abs(rect(cards[0]).width-rect(cards[1]).width)<2,
              action:form.querySelector('.form-foot [type=submit]')?.textContent.trim() };
          });
          assert.equal(layout.footerVisible,true,'Acción inferior visible');
          assert.equal(layout.noOverflow,true,'Sin desplazamiento horizontal');
          assert.equal(layout.cardsEqual,true,'Bloques con igual ancho');
          assert.match(layout.action,/Registrar cargos/);
          if(theme==='light')assert.equal(layout.bg,'rgb(255, 255, 255)');
          if(theme==='black')assert.equal(layout.bg,'rgb(0, 0, 0)');
          assert.deepEqual(errors,[],'Errores JavaScript');
          await p.screenshot({path:path.join(output,browserName+'-'+theme+'-'+w+'.png'),fullPage:false});
          results.push({browser:browserName,theme,viewport:w+'x'+h,ok:true,layout});
          console.log('✓ '+browserName+' '+theme+' '+w+'x'+h+' anualidad/seguros');
        } finally { await ctx.close(); }
      }
    }
    fs.writeFileSync(path.join(output,browserName+'-resultados.json'),JSON.stringify(results,null,2));
    console.log('OK '+results.length+' escenarios');
  } finally { await browser.close(); }
})().catch(err => { console.error(err.stack||err);process.exitCode=1; });
