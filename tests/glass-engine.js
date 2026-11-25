/* VIVE Glass Engine — pruebas visuales y funcionales (Playwright).
   Uso: node tests/glass-engine.js   (servidor estático en :8765 o lo levanta el propio test) */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');let ok=0,bad=0;
const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x))}};
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m);return (x+.05)/(y+.05)};
const parse=c=>{const m=String(c).match(/rgba?\(([^)]+)\)/);if(m){const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {rgb:p.slice(0,3),a:p.length>3?p[3]:1}}return null};
const over=(fg,bg)=>fg.rgb.map((v,i)=>Math.round(v*fg.a+bg[i]*(1-fg.a)));
function serve(){return new Promise(res=>{const s=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}const ext=path.extname(f);r.writeHead(200,{'content-type':{'.html':'text/html','.css':'text/css','.js':'application/javascript'}[ext]||'application/octet-stream'});r.end(d)})}).listen(0,()=>res(s))})}
(async()=>{
 const srv=await serve(),base='http://localhost:'+srv.address().port;
 const b=await chromium.launch();const errs=[];
 const accents=['#6d69f1','#0f9f8f','#e0527a','#d98a1c','#2d8cf0','#8a5cf6'];
 for(const theme of ['light','black']){
  const p=await b.newPage({viewport:{width:1280,height:900}});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+'/glass-catalog.html');await p.waitForTimeout(300);
  if(theme==='black')await p.click('#t-black');
  const base0=theme==='black'?[0,0,0]:[255,255,255];
  // 1 · base pura
  const bg=await p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  check(`[${theme}] fondo base ${theme==='black'?'#000000':'#FFFFFF'} puro`,bg==='rgb('+base0.join(', ')+')',bg);
  // 2 · niveles monótonos y blur solo 02-05
  const lv=await p.evaluate(()=>{const g=n=>parseFloat(getComputedStyle(document.body).getPropertyValue('--vg-a'+n));const bl=n=>getComputedStyle(document.body).getPropertyValue('--vg-b'+n).trim();return {a:[1,2,3,4,5].map(g),b:[1,2,3,4,5].map(bl)}});
  check(`[${theme}] alfa creciente por nivel 01→05`,lv.a.every((v,i)=>i===0||v>lv.a[i-1]),lv.a);
  check(`[${theme}] nivel 01 sin desenfoque; 02–05 con desenfoque`,lv.b[0]==='0px'&&lv.b.slice(1).every(x=>parseFloat(x)>0),lv.b);
  // 3 · contraste de texto sobre la base y sobre cada nivel (compuesto sobre la base)
  const ink=await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--vg-ink').trim());
  const ih=ink.startsWith('#')?[1,3,5].map(i=>parseInt(ink.slice(i,i+2),16)):[0,0,0];
  for(let n=1;n<=5;n++){const a=lv.a[n-1];const fill=theme==='black'?[255,255,255]:[255,255,255];const eff=over({rgb:fill,a},base0);check(`[${theme}] contraste texto/nivel 0${n} ≥ 7`,ratio(ih,eff)>=7,ratio(ih,eff).toFixed(1))}
  // 4 · acentos: botón primario y segmentado seleccionado
  for(const c of accents){
   await p.evaluate(c=>{document.documentElement.style.setProperty('--ui-accent',c);document.body.style.setProperty('--vx-accent',c);document.body.style.removeProperty('--vx-accent-strong')},c);
   const m=await p.evaluate(()=>{const q=s=>getComputedStyle(document.querySelector(s));const pr=q('.vg-button.is-primary');const sel=q('.vg-segmented>[aria-pressed="true"]');return {prBg:pr.backgroundImage,prFg:pr.color,selFg:sel.color,selBg:sel.backgroundColor,selBd:sel.borderTopColor}});
   const accent=parse(await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--vg-accent-strong'))||'')||null;
   const st=await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--vg-accent-strong').trim());
   // texto blanco sobre acento fuerte (relleno del botón primario)
   const hexOrRgb=st.startsWith('#')?{rgb:[1,3,5].map(i=>parseInt(st.slice(i,i+2),16)),a:1}:parse(st);
   if(hexOrRgb)check(`[${theme}] ${c} botón primario: blanco/acento ≥ 3 (texto grande)`,ratio([255,255,255],hexOrRgb.rgb)>=3,ratio([255,255,255],hexOrRgb.rgb).toFixed(2));
   const sf=parse(m.selFg),sb=parse(m.selBg);
   if(sf&&sb){const eff=over(sb,base0);check(`[${theme}] ${c} segmentado seleccionado legible ≥ 3`,ratio(sf.rgb,eff)>=3,ratio(sf.rgb,eff).toFixed(2))}
  }
  // 5 · intensidades
  for(const k of [0,100,160]){await p.evaluate(k=>ViveGlass.apply({intensity:k,accent:100,light:100}),k);const v=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--vg-k').trim());check(`[${theme}] intensidad ${k}% → --vg-k=${(k/100).toFixed(3)}`,v===(k/100).toFixed(3),v)}
  await p.evaluate(()=>ViveGlass.restore());
  // 6 · reducir transparencia / movimiento
  await p.evaluate(()=>ViveGlass.apply({reduceTransparency:true,reduceMotion:true}));
  const rt=await p.evaluate(()=>{const e=document.querySelector('.lv.vg-l4');const c=getComputedStyle(e);return {bf:c.backdropFilter||c.webkitBackdropFilter,cls:document.documentElement.className,tr:c.transitionDuration}});
  check(`[${theme}] reducir transparencia → sin desenfoque`,/none|blur\(0px\)/.test(rt.bf)||rt.bf==='',rt);
  check(`[${theme}] reducir movimiento → transiciones ~0`,parseFloat(rt.tr)<=.001,rt.tr);
  await p.evaluate(()=>ViveGlass.restore());
  // 7 · decorativos no capturan eventos; sin desbordes
  const dec=await p.evaluate(()=>{const e=document.querySelector('.stage');return getComputedStyle(e,'::before').pointerEvents});
  check(`[${theme}] fondo decorativo sin eventos`,dec==='none',dec);
  check(`[${theme}] sin desbordamiento horizontal (1280)`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // 8 · estados: hover/focus/active/disabled
  const dis=await p.evaluate(()=>getComputedStyle(document.querySelector('.vg-button[disabled]')).pointerEvents);check(`[${theme}] deshabilitado sin interacción`,dis==='none');
  await p.focus('.vg-input');const fo=await p.evaluate(()=>getComputedStyle(document.querySelector('.vg-input')).boxShadow);check(`[${theme}] foco visible con anillo de acento`,/rgba?\(|color\(/.test(fo)&&fo!=='none',fo.slice(0,60));
  await p.close();
 }
 // móvil
 for(const theme of ['light','black']){const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});p.on('pageerror',e=>errs.push(e.message));await p.goto(base+'/glass-catalog.html');if(theme==='black')await p.click('#t-black');await p.waitForTimeout(300);
  check(`[móvil ${theme}] sin desbordamiento horizontal (390)`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),await p.evaluate(()=>document.documentElement.scrollWidth));
  const bf=await p.evaluate(()=>getComputedStyle(document.querySelector('.lv.vg-l4')).backdropFilter);check(`[móvil ${theme}] desenfoque reducido en táctil (≤ 20px)`,/blur\((\d+(\.\d+)?)px/.test(bf)&&parseFloat(bf.match(/blur\((\d+(\.\d+)?)px/)[1])<=20,bf);await p.close()}
 // integración en la app (Supabase simulado)
 {const open=require('./harness.js');const {chromium:c2}=require('playwright');
  process.env.ROOT=ROOT;
  const app=await open(b,390,844);const p=app.p;p.on('pageerror',e=>errs.push(e.message));
  const has=await p.evaluate(()=>typeof window.ViveGlass==='object'&&!!window.ViveGlass.apply);check('[app] ViveGlass disponible',has);
  const rules=await p.evaluate(()=>[...document.styleSheets].some(s=>/glass-engine\.css/.test(s.href||'')));check('[app] glass-engine.css cargado',rules);
  // segmented sin fondo en Registrar movimiento
  await p.evaluate(()=>{const t=db.transactions.find(x=>x.type==='expense');const x=document.createElement('button');x.dataset.act='editTransaction';x.dataset.id=t.id;document.body.appendChild(x);x.click()});await p.waitForTimeout(1000);
  const seg=await p.evaluate(()=>{const n=document.querySelector('.v749-segment');if(!n)return null;const c=getComputedStyle(n);return {bg:c.backgroundColor,pad:c.padding}});check('[app] selector Gasto/Ingreso/Transferencia sin fondo',seg&&seg.bg==='rgba(0, 0, 0, 0)'&&seg.pad==='0px',seg);
  // preferencias: aplicar sin peticiones de red adicionales
  let net=0;p.on('request',r=>{if(/supabase\.co/.test(r.url()))net++});
  await p.evaluate(()=>document.getElementById('modal-root').innerHTML='');
  await p.evaluate(()=>{ViveGlass.apply({intensity:40,accent:60,light:140});});
  const kv=await p.evaluate(()=>[...['--vg-k','--vg-ak','--vg-lk']].map(k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim()).join(','));check('[app] preferencias aplicadas al instante (0,4/0,6/1,4)',kv==='0.400,0.600,1.400',kv);
  await p.waitForTimeout(600);check('[app] aplicar preferencias no genera peticiones a Supabase',net===0,net);
 }
 check('sin errores de JavaScript',errs.length===0,errs.slice(0,3));
 await b.close();srv.close();
 console.log(`\nGLASS ENGINE: ${ok} verificaciones aprobadas${bad?', '+bad+' FALLAN':''}`);process.exit(bad?1:0);
})();
