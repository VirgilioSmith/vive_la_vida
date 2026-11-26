'use strict';
/* Design System universal: tokens, Claro/Black, acentos, semánticos fijos, tipografía de 4 pesos, iconos 16/20/24 y contraste WCAG AA medido. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const open=require('./harness');
const {medir}=require('./lib-contraste');
const OUT=path.join(__dirname,'..','test-results','auditoria','fase02');
const ACENTOS=[['violeta','#6d69f1'],['rojo','#e5484d'],['verde','#16a34a'],['azul','#1d63e0']];
(async()=>{
 const b=await chromium.launch();let resumen=[];
 for(const [w,h] of [[1280,900],[390,844]]){
  process.env.THEME='light';if(w<800)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/design-system.html',{waitUntil:'load'});await p.waitForSelector('#ds');
  const tok=await p.evaluate(()=>{const s=getComputedStyle(document.body);const names=['--vx-accent','--vx-accent-soft','--vx-text','--vx-text-2','--vx-text-3','--vx-glass-1','--vx-glass-2','--vx-glass-raised','--vx-income','--vx-expense','--vx-warning','--vx-blur-card','--vx-blur-nav','--vx-gutter','--vx-h-control','--vx-r-lg','--vx-icon','--vx-fw-bold','--vx-fs-kpi','--vx-focus','--vx-disabled-fg'];return names.filter(n=>!s.getPropertyValue(n).trim())});
  assert.deepEqual(tok,[],`tokens sin definir: ${tok}`);
  const g=await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--vx-gutter').trim());assert.equal(g,w<800?'16px':'24px','gutter propio por plataforma');
  const semBase={};
  for(const theme of ['light','black']){
   await p.click(`[data-theme="${theme}"]`);
   for(const [nombre,hex] of ACENTOS){
    await p.evaluate(h=>document.body.style.setProperty('--vive-theme-color',h),hex);await p.waitForTimeout(80);
    const tag=`${w<800?'movil':'pc'}-${theme}-${nombre}`;
    const sem=await p.evaluate(()=>{const s=getComputedStyle(document.body);return ['--vx-income','--vx-expense','--vx-warning'].map(n=>s.getPropertyValue(n).trim()).join('|')});
    semBase[theme]=semBase[theme]||sem;assert.equal(sem,semBase[theme],`[${tag}] semánticos financieros NO cambian con el acento`);
    const acc=await p.evaluate(()=>getComputedStyle(document.querySelector('.vx-btn.is-primary')).backgroundColor);
    assert.notEqual(acc,'rgba(0, 0, 0, 0)',`[${tag}] primario con acento`);
    const bg=await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--vx-bg').trim());
    if(theme==='black')assert.equal(bg,'#000',`[${tag}] Black auténtico`);
    const c=await medir(p,{root:'#ds',max:260});
    resumen.push({tag,medidos:c.medidos,fallos:c.fallos});
    if(nombre==='violeta'||nombre==='rojo')await p.screenshot({path:path.join(OUT,`ds-${tag}.jpg`),type:'jpeg',quality:70,fullPage:true});
   }
  }
  const typ=await p.evaluate(()=>{const ws=new Set();document.querySelectorAll('#ds *').forEach(e=>{if([...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))ws.add(getComputedStyle(e).fontWeight)});return [...ws].sort()});
  assert.ok(typ.every(x=>['400','500','600','700'].includes(x)),`pesos tipográficos solo 400/500/600/700: ${typ}`);
  const ic=await p.evaluate(()=>[...document.querySelectorAll('#ds svg.vx-icon')].map(s=>Math.round(s.getBoundingClientRect().width)));assert.ok(ic.every(x=>[16,20,24].includes(x)),`iconos 16/20/24: ${ic}`);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sin desborde horizontal');
  assert.deepEqual(errs,[],'consola');
  await ctx.close();
 }
 await b.close();
 const malos=resumen.filter(r=>r.fallos.length);
 console.log('Contraste medido en',resumen.length,'combinaciones;',resumen.reduce((a,r)=>a+r.medidos,0),'textos.');
 for(const r of malos)console.log('FALLA',r.tag,JSON.stringify(r.fallos.slice(0,4)));
 require('fs').writeFileSync(path.join(OUT,'contraste-design-system.json'),JSON.stringify(resumen,null,1));
 assert.equal(malos.length,0,'contraste AA en el Design System');
 console.log('design-system: OK');
})().catch(e=>{console.error(e);process.exit(1)});
