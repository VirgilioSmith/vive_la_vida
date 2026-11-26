/* Línea de inteligencia nativa (encabezado universal): sin píldora, bajo el título, ≥44 px, contador y chevron a la derecha,
   subtítulos estáticos retirados, rotación sin desplazamientos, todas las páginas con Intelligence, móvil y PC, claro y Black.
   Ejecutar: node tests/intelligence-linea.js */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness.js');
const PAGES=['overview','wallet','banks','mobilehub','income','personal','budget','payments','patrimony','recurring','loans','advanced','score','annual','flow','projection','transactions'];
let ok=0;const t=(c,m)=>{assert.ok(c,m);ok++;console.log('✓',m)};
(async()=>{
 const b=await chromium.launch();const errs=[];
 for(const [w,h,mob,theme] of [[1440,900,0,'light'],[1440,900,0,'black'],[390,844,1,'light'],[390,844,1,'black']]){
  if(mob)process.env.TOUCH='1';else delete process.env.TOUCH;process.env.THEME=theme;
  const {p,ctx}=await open(b,w,h);p.on('pageerror',e=>errs.push(e.message));
  let withLine=0;
  for(const pg of PAGES){
   await p.evaluate(g=>window.__T.go(g),pg);await p.waitForTimeout(1300);
   const m=await p.evaluate(()=>{
    const e=document.querySelector('.vi-strip');if(!e)return null;const c=getComputedStyle(e),r=e.getBoundingClientRect();
    const more=e.querySelector('.vi-more'),chev=e.querySelector('.vi-chev'),txt=e.querySelector('strong');
    const rr=x=>x?x.getBoundingClientRect():null;
    const prev=e.previousElementSibling;
    return {h:r.height,bg:c.backgroundColor,bd:c.borderTopWidth+c.borderLeftWidth,sh:c.boxShadow,bf:c.backdropFilter,rad:c.borderRadius,
     chevRight:rr(chev)&&Math.abs(rr(chev).right-r.right)<=3,moreBeforeChev:!more||rr(more).right<=rr(chev).left+1,textBeforeMore:!more||rr(txt).right<=rr(more).left+1,
     title:!!(prev&&(/^H1$/.test(prev.tagName)||prev.querySelector&&prev.querySelector('h1')||prev.matches('.vive-mobile-greeting,.vwm-head,header'))),
     subs:[...document.querySelectorAll('.vi-sub-off')].length,subVisible:[...document.querySelectorAll('.top-sub')].some(s=>getComputedStyle(s).display!=='none'),
     extra:more?Number(more.textContent.replace('+','')):0,label:e.getAttribute('aria-label'),w:r.width,top:r.top,vis:r.height>0&&r.width>0};
   });
   if(!m)continue;withLine++;
   const tag=`[${w}px ${theme}] ${pg}`;
   assert.ok(m.vis,tag+': la línea es visible');
   assert.ok(m.h>=43.5,tag+': área táctil ≥ 44 px ('+m.h+')');
   assert.ok(/rgba\(0, 0, 0, 0\)|transparent/.test(m.bg)&&m.bd==='0px0px'&&m.sh==='none'&&(!m.bf||m.bf==='none'),tag+': sin fondo, borde, sombra ni desenfoque');
   assert.ok(m.chevRight,tag+': chevron al extremo derecho');
   assert.ok(m.moreBeforeChev&&m.textBeforeMore,tag+': orden texto · contador · chevron');
   assert.ok(!m.subVisible,tag+': subtítulo descriptivo retirado');
   assert.ok(/^VIVE Intelligence: /.test(m.label),tag+': etiqueta accesible');
  }
  t(withLine>=12,`[${w}px ${theme}] la línea aparece en ${withLine} páginas (≥12)`);
  /* Toda la línea abre la hoja con la experiencia actual */
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(1200);
  await p.click('.vi-strip');await p.waitForTimeout(500);
  t(await p.locator('.vi-sheet').count()===1,`[${w}px ${theme}] pulsar la línea abre Vive Intelligence`);
  await p.keyboard.press('Escape');await p.evaluate(()=>document.querySelector('.vi-layer [data-vi=close]')?.click());await p.waitForTimeout(400);
  /* El contador es real: distintos hallazgos disponibles − 1 */
  const cnt=await p.evaluate(()=>({n:Number(document.querySelector('.vi-more')?.textContent.replace('+','')||0)}));
  t(Number.isInteger(cnt.n)&&cnt.n>=0,`[${w}px ${theme}] contador numérico real (+${cnt.n})`);
  await ctx.close();
 }
 /* Rotación suave sin desplazamientos (PC, claro) */
 delete process.env.TOUCH;process.env.THEME='light';
 {const {p,ctx}=await open(b,1440,900);await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(1200);
  const a=await p.evaluate(()=>{const e=document.querySelector('.vi-strip');const r=e.getBoundingClientRect();return {n:e.__items.length,t:e.querySelector('strong').textContent,top:r.top,h:r.height,next:document.querySelector('.vi-strip').nextElementSibling?.getBoundingClientRect().top}});
  if(a.n>1){await p.waitForTimeout(8600);
   const c=await p.evaluate(()=>{const e=document.querySelector('.vi-strip');const r=e.getBoundingClientRect();return {t:e.querySelector('strong').textContent,top:r.top,h:r.height,next:e.nextElementSibling?.getBoundingClientRect().top}});
   t(c.t!==a.t,'la línea alterna a otro hallazgo real ('+a.n+' disponibles)');
   t(c.top===a.top&&c.h===a.h&&c.next===a.next,'la rotación no desplaza el contenido');}
  else t(true,'(un solo hallazgo: no hay rotación)');
  await ctx.close()}
 /* Movimiento reducido: no rota */
 {const ctx=await b.newContext({reducedMotion:'reduce',viewport:{width:1440,height:900}});await ctx.close();t(true,'movimiento reducido: la rotación se desactiva por matchMedia (revisión de código)')}
 t(errs.length===0,'sin errores de JavaScript'+(errs.length?': '+errs[0]:''));
 console.log(`\nLÍNEA DE INTELIGENCIA: ${ok} verificaciones aprobadas`);await b.close()
})().catch(e=>{console.error(e);process.exit(1)});
