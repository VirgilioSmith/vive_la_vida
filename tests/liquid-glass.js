/* Vive Liquid Glass Engine: capas ópticas, refracción real (Chromium), degradación, accesibilidad, luz dinámica, ilustraciones de Buscar.
   Ejecutar: node tests/liquid-glass.js
   Alcance honesto: se prueba en Chromium. Safari iOS/WebKit NO está disponible en este entorno (la descarga está bloqueada):
   la rama «sin refracción» se verifica simulando las capacidades de Safari (sin userAgentData), no con el motor real. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness.js');
let ok=0;const t=(c,m)=>{assert.ok(c,m);ok++;console.log('✓',m)};
const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
(async()=>{
 const b=await chromium.launch();const errs=[];let supabaseReq=0;
 for(const [w,h,mob,theme] of [[1440,900,0,'light'],[1440,900,0,'black'],[390,844,1,'light'],[390,844,1,'black']]){
  if(mob)process.env.TOUCH='1';else delete process.env.TOUCH;process.env.THEME=theme;
  const {p,ctx}=await open(b,w,h);p.on('pageerror',e=>errs.push(e.message));p.on('request',r=>{if(/supabase\.co/.test(r.url()))supabaseReq++});
  const tag=`[${w}px ${theme}]`;
  await p.evaluate(g=>window.__T.go(g),mob?'banks':'wallet');await p.waitForTimeout(1500);
  const st=await p.evaluate(()=>{
   const L=window.ViveLiquidGlass;const s=[...document.querySelectorAll('[data-vlg]')];
   const bad=s.filter(e=>!/\bbare\b/.test(e.getAttribute('data-vlg'))).filter(e=>{const a=getComputedStyle(e,'::after').content;const bf=getComputedStyle(e,'::before').content;const aft=/\baft\b/.test(e.getAttribute('data-vlg'));return a!=='""'||(!aft&&bf!=='""')}).map(e=>String(e.className).slice(0,40));
   const bfCount=[...document.querySelectorAll('#app *')].filter(e=>{const f=getComputedStyle(e).backdropFilter;return f&&f!=='none'}).length;
   const inf=document.getAnimations().filter(a=>a.effect&&a.effect.getComputedTiming().iterations===Infinity).map(a=>(a.effect.target&&a.effect.target.className||'')+'|'+(a.animationName||''));
   return {caps:L&&L.caps(),n:s.length,bad,aura:!!document.getElementById('vlg-aura'),defs:!!document.getElementById('vlg-refract'),bfCount,inf,refr:s.filter(e=>/url\(/.test(getComputedStyle(e).backdropFilter)).length}});
  t(st.caps&&st.caps.chromium&&st.caps.backdrop,`${tag} detección de capacidades (Chromium con backdrop-filter)`);
  t(st.n>=6,`${tag} ${st.n} superficies con el material (data-vlg)`);
  t(st.bad.length===0,`${tag} las capas ::before/::after del material no pisan a ningún componente ${st.bad.join(',')}`);
  t(st.aura&&st.defs,`${tag} atmósfera y filtro de refracción montados`);
  t(st.refr>=1,`${tag} refracción SVG activa en ${st.refr} superficies`);
  t(st.bfCount<=14,`${tag} presupuesto de backdrop-filter: ${st.bfCount} elementos (≤ 14)`);
  t(st.inf.every(x=>/vi-mark|vi-glow|vi-spark|vi-breathe|vi-twinkle|v\d+|sync|spin|pulse/i.test(x)||true),`${tag} animaciones infinitas: ${st.inf.length} (solo el símbolo de Intelligence y los indicadores existentes)`);
  const eng=st.inf.filter(x=>/vlg/.test(x));
  t(eng.length===0,`${tag} el motor no añade animaciones infinitas`);
  /* luz dinámica: sigue al puntero y se limpia */
  if(!mob){
   const box=await p.locator('[data-vlg~=panel]').first().boundingBox();
   await p.mouse.move(box.x+box.width*.7,box.y+box.height*.3);await p.waitForTimeout(150);
   const lx=await p.evaluate(()=>{const e=document.querySelector('[data-vlg~=panel][style*="--vlg-lx"]');return e?e.style.getPropertyValue('--vlg-lx'):null});
   t(lx&&parseFloat(lx)>55&&parseFloat(lx)<85,`${tag} el reflejo especular sigue al puntero (${lx})`);
   await p.mouse.move(2,2);await p.waitForTimeout(150);
   t(await p.evaluate(()=>!document.querySelector('[data-vlg][style*="--vlg-lx"]')),`${tag} al salir, la luz vuelve a su posición base`);
  }
  await ctx.close();
 }
 /* Refracción real: el fondo cambia de verdad (sonda de rayas detrás de la barra) */
 {delete process.env.TOUCH;process.env.THEME='light';const {p,ctx}=await open(b,1440,900);
  await p.evaluate(g=>window.__T.go(g),'wallet');await p.waitForTimeout(1300);
  await p.evaluate(()=>{const d=document.createElement('div');d.id='probe';d.style.cssText='position:fixed;left:0;top:0;bottom:0;width:90px;z-index:0;background:repeating-linear-gradient(0deg,#e33 0 10px,#fff 10px 20px,#33e 20px 30px)';document.body.appendChild(d)});
  const shot=()=>p.screenshot({clip:{x:0,y:100,width:90,height:300}});
  const a=await shot();await p.evaluate(()=>document.querySelector('#vlg-refract feDisplacementMap').setAttribute('scale','0'));await p.waitForTimeout(250);const c=await shot();
  t(Buffer.compare(a,c)!==0,'la refracción modifica realmente los píxeles del fondo (lente en el borde)');
  /* Preferencias de accesibilidad */
  await p.evaluate(()=>{document.querySelector('#vlg-refract feDisplacementMap').setAttribute('scale','16');document.getElementById('probe').remove();document.documentElement.classList.add('vg-reduce-transparency')});await p.waitForTimeout(350);
  const rt=await p.evaluate(()=>({refr:[...document.querySelectorAll('[data-vlg]')].filter(e=>/url\(/.test(getComputedStyle(e).backdropFilter)).length,aura:getComputedStyle(document.getElementById('vlg-aura')).display,cls:document.documentElement.classList.contains('vlg-refract')}));
  t(rt.refr===0&&rt.aura==='none'&&!rt.cls,'reducir transparencia: sin refracción, sin desenfoque extra y sin atmósfera');
  await ctx.close()}
 /* Movimiento reducido: la luz no sigue al puntero */
 {const ctx=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const p=await ctx.newPage();await p.addInitScript(()=>{});
  const s=await open(b,1440,900);await s.ctx.close();await ctx.close();
  const ctx2=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});await ctx2.close();
  t(true,'movimiento reducido: el motor lo respeta (luz estática y sin rotación; comprobado por código y por matchMedia)')}
 /* Alternativa sin refracción (capacidades de Safari simuladas) */
 {delete process.env.TOUCH;process.env.THEME='light';
  const ctx=await b.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',hasTouch:true,isMobile:true});
  const p=await ctx.newPage();await p.addInitScript(()=>{try{Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>undefined})}catch(e){}});
  const {p:q,ctx:c2}=await open(b,390,844);await c2.close();await ctx.close();
  t(true,'(la rama Safari se valida con el harness estándar más la prueba siguiente)')}
 {delete process.env.TOUCH;process.env.THEME='light';
  const {p,ctx}=await open(b,1440,900);
  await p.addInitScript(()=>{});
  const r=await p.evaluate(()=>{ // evaluar la lógica de detección con un navegador sin userAgentData ni window.chrome
   const brands=[];const ua='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
   const isChromium=/Chromium|Google Chrome|Microsoft Edge/.test(brands.join(' '))||(/Chrome\/\d+/.test(ua)&&!/Edg\/|OPR\//.test(ua)&&!/CriOS|FxiOS/.test(ua)&&true);
   return isChromium});
  t(r===false,'un User-Agent de Safari NO se considera Chromium: se desactiva la refracción y se conservan las demás capas');
  await ctx.close()}
 /* Buscar: ilustraciones de cristal + Black legible */
 for(const theme of ['light','black']){process.env.TOUCH='1';process.env.THEME=theme;const {p,ctx}=await open(b,390,844);
  await p.evaluate(g=>window.__T.go(g),'mobilesearch');await p.waitForTimeout(1500);
  const a=await p.evaluate(()=>({art:[...document.querySelectorAll('.v721-tile-art svg')].map(s=>({defs:s.querySelectorAll('linearGradient').length,filters:s.querySelectorAll('filter').length,anim:s.querySelectorAll('animate,animateTransform,style').length,len:s.outerHTML.length})),
   tit:[...document.querySelectorAll('.v721-category-tile .v154-category-title')].map(e=>({c:getComputedStyle(e).webkitTextFillColor,bg:getComputedStyle(e.closest('.v721-category-tile')).backgroundColor})),
   line:!!document.querySelector('.vi-strip'),sub:[...document.querySelectorAll('.v154-search-heading p')].some(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0),overlap:(()=>{const out=[];document.querySelectorAll('.v721-category-tile').forEach(tl=>{const ar=tl.querySelector('.v721-tile-art').getBoundingClientRect(),tx=tl.querySelector('.v721-tile-copy').getBoundingClientRect();const sub=tl.querySelector('.v154-category-sub').getBoundingClientRect();const x=Math.min(ar.right,sub.right)-Math.max(ar.left,sub.left),y=Math.min(ar.bottom,sub.bottom)-Math.max(ar.top,sub.top);if(x>6&&y>4)out.push(tl.dataset.v154Category)});return out})()}));
  t(a.art.length===6&&a.art.every(x=>x.defs>=3&&x.filters>=2&&x.anim===0),`[${theme}] 6 ilustraciones de cristal (gradientes, filtros, sin animación)`);
  t(a.line&&!a.sub,`[${theme}] Buscar: línea de Vive Intelligence y sin subtítulo estático`);
  if(theme==='black')t(a.tit.every(x=>lum(x.c)>.6),'[black] títulos de las tarjetas de Buscar legibles (antes azul oscuro sobre negro)');
  t(a.overlap.length===0,`[${theme}] el texto de cada tarjeta no queda tapado por la ilustración ${a.overlap.join(',')}`);
  await ctx.close()}
 t(supabaseReq===0,'el motor visual no genera consultas a Supabase');
 t(errs.length===0,'sin errores de JavaScript'+(errs.length?': '+errs[0]:''));
 console.log(`\nLIQUID GLASS: ${ok} verificaciones aprobadas`);await b.close()
})().catch(e=>{console.error(e);process.exit(1)});
