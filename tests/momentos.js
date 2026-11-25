/* Momentos: motor (prioridades, colas), reproductor inmersivo, persistencia, red y limpieza. */
const {chromium}=require('playwright');const open=require('./harness');const assert=require('assert');
(async()=>{const b=await chromium.launch();process.env.TOUCH='1';let n=0;const ok=(c,m)=>{assert.ok(c,m);n++};
const compact=async p=>{await p.evaluate(()=>window.scrollTo(0,0));for(let i=0;i<5;i++){await p.mouse.wheel(0,120);await p.waitForTimeout(60)}await p.waitForTimeout(500)};
/* 1 · Motor puro, en el navegador */
{process.env.THEME='light';const {p}=await open(b,402,874);
 const r=await p.evaluate(()=>{const E=window.ViveMomentosEngine,o={seed:'t'};const q=(s,m,x)=>E.build(s,m||'all',Object.assign({},o,x||{}));
  const ids=l=>l.map(x=>x.id);const base={verified:true,overdue:[],upcoming:[],cuts:[],goals:[]};
  const A=q(Object.assign({},base,{overdue:[{name:'Visa',days:-2,go:'wallet'}],upcoming:[{name:'Préstamo',days:3,go:'pressure'}],cuts:[{name:'Qik',days:5,go:'wallet'}],improving:{net:'RD$1',prev:'RD$0'}}));
  const calm=q(base),none=q({verified:false}),resolved=q(Object.assign({},base,{upcoming:[{name:'P',days:2,go:'pressure'}]}));
  const all=q(base);const dupes=ids(A).length!==new Set(ids(A)).size;
  const joseo=q(base,'joseo'),goals=q(base,'goals'),fav=q(base,'favorites',{favorites:new Set(['j1','l1'])});
  const rec=q(base,'all',{recent:['l1','j1']});const ids2=ids(rec);
  const pb=E.createPlayback();pb.setQueue(q(base));pb.play();let ended=false,steps=0;for(let i=0;i<4000&&!ended;i++){const t=pb.tick(.25);steps++;if(t==='ended')ended=true}
  return {A:ids(A),prio:A.map(x=>x.priority),calm:calm.map(x=>x.title),none:none.map(x=>x.title),resolved:ids(resolved),dupes,joseo:joseo.map(x=>x.mode),goals:goals.length,fav:ids(fav),recentLeft:ids2.some(i=>['l1','j1'].includes(i)),ended,joseoLen:E.PHRASES.filter(x=>x.mode==='joseo').length};});
 ok(r.A[0]==='overdue'&&r.A[1]==='payment'&&r.A[2]==='cut','prioridad: vencido > pago > corte '+r.A.slice(0,4));
 ok(r.prio.slice(0,4).every((v,i,a)=>!i||a[i-1]>=v),'orden por prioridad');ok(!r.dupes,'sin duplicados');
 ok(r.calm.includes('Todo tranquilo')&&r.calm.at(-1)==='Todo tranquilo','sin alertas: cierre "Todo tranquilo"');
 ok(!r.none.includes('Todo tranquilo')&&r.none[0]==='Datos pendientes','sin datos verificados: no "Todo tranquilo"');
 ok(r.resolved.includes('payment')&&!(await p.evaluate(()=>window.ViveMomentosEngine.build({verified:true,overdue:[],upcoming:[],cuts:[]},'all').map(x=>x.id)).then(x=>x.includes('payment'))),'alerta resuelta desaparece de la cola');
 ok(r.joseo.every(m=>m==='joseo')&&r.joseo.length>=9&&r.joseoLen>=9,'Joseo es categoría independiente');ok(r.goals===0,'Mis metas vacío sin metas reales (no inventa)');
 ok(r.fav.sort().join()==='j1,l1','Favoritos filtra');ok(r.ended,'la reproducción termina con cierre');
 ok(!r.recentLeft,'rotación: no repite frases recientes habiendo alternativas');await p.close()}
/* 2 · Reproductor móvil */
for(const theme of ['light','black'])for(const w of [320,375,430]){process.env.THEME=theme;const {ctx,p}=await open(b,w,w===320?640:874);const tag=`${theme}-${w}`;
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 let sb=0;p.on('request',q=>{if(/supabase\.co/.test(q.url()))sb++});
 await p.evaluate(()=>window.__T.go('wallet'));await p.waitForTimeout(500);await compact(p);
 await p.tap('.vive-mobile-dock-center');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>document.getAnimations().length>0),tag+' animación de expansión activa (FLIP)');await p.waitForTimeout(700);
 ok(await p.evaluate(()=>ViveMomentos.isOpen),tag+' abre');
 const g=await p.evaluate(()=>{const d=document.querySelector('dialog.vmo');const bs=[...d.querySelectorAll('button')].filter(x=>x.offsetParent&&!x.hidden);return {h:document.documentElement.scrollWidth>innerWidth||d.scrollWidth>d.clientWidth,small:bs.filter(x=>{const r=x.getBoundingClientRect();return r.width<43.5||r.height<43.5}).map(x=>x.getAttribute('aria-label')||x.textContent.trim()),lbl:bs.filter(x=>!(x.getAttribute('aria-label')||x.textContent.trim())).length,title:document.querySelector('#vmoTitle').textContent,fits:(()=>{const r=d.querySelector('.vmo-play').getBoundingClientRect();return r.bottom<=innerHeight||d.scrollHeight>d.clientHeight})(),edge:(()=>{const a=d.querySelector('.vmo-art').getBoundingClientRect(),q=d.getBoundingClientRect();return a.top<=q.top+0.5&&a.width>=q.width-1})()}});
 ok(!g.h,tag+' sin scroll horizontal');ok(g.small.length===0,tag+' botones ≥44px '+g.small);ok(g.lbl===0,tag+' botones con etiqueta');ok(g.fits,tag+' controles alcanzables');ok(g.edge,tag+' portada a pantalla completa desde el borde superior');ok(g.title==='Atención requerida',tag+' primer momento: alerta real');
 /* play/pause, siguiente/anterior, progreso */
 const play=()=>p.evaluate(()=>ViveMomentos.state.pb.state.playing);
 ok(await play(),tag+' reproduce al abrir');await p.tap('.vmo-play');ok(!(await play()),tag+' pausa');await p.tap('.vmo-play');ok(await play(),tag+' reanuda');
 await p.tap('[data-vmo=next]');await p.waitForTimeout(200);const t2=await p.locator('#vmoTitle').innerText();ok(t2!=='Atención requerida',tag+' siguiente');
 await p.tap('[data-vmo=prev]');await p.waitForTimeout(200);ok((await p.locator('#vmoTitle').innerText())==='Atención requerida',tag+' anterior');
 /* avance automático en un momento no crítico */
 await p.evaluate(()=>{const s=ViveMomentos.state.pb;s.go(s.state.queue.findIndex(x=>!x.hold));s.state.elapsed=s.current().seconds-.3;});await p.waitForTimeout(900);
 ok(await p.evaluate(()=>ViveMomentos.state.pb.state.idx)>1||await p.evaluate(()=>ViveMomentos.state.pb.state.elapsed<3),tag+' avance automático');
 /* barra de progreso */
 await p.evaluate(()=>{const i=document.querySelector('#vmoProg');i.value=50;i.dispatchEvent(new Event('input',{bubbles:true}))});
 ok(await p.evaluate(()=>{const s=ViveMomentos.state.pb;return Math.abs(s.state.elapsed-s.current().seconds*.5)<1}),tag+' barra de progreso');
 /* modos independientes */
 await p.selectOption('#vmoMode','joseo');await p.waitForTimeout(200);ok(await p.evaluate(()=>ViveMomentos.state.pb.state.queue.every(x=>x.mode==='joseo')),tag+' modo Joseo');
 await p.selectOption('#vmoMode','life');ok(await p.evaluate(()=>ViveMomentos.state.pb.state.queue.every(x=>x.mode==='life')),tag+' modo Vive el hoy');
 await p.selectOption('#vmoMode','goals');ok((await p.locator('#vmoTitle').innerText())==='Sin momentos',tag+' metas sin datos: estado vacío honesto');
 /* favoritos + persistencia */
 await p.selectOption('#vmoMode','joseo');await p.tap('[data-vmo=fav]');
 const fid=await p.evaluate(()=>ViveMomentos.state.pb.current().id);ok(await p.evaluate(id=>JSON.parse(localStorage.getItem('vive.momentos.fav.v1')).includes(id),fid),tag+' favorito guardado');
 await p.selectOption('#vmoMode','favorites');ok((await p.locator('#vmoTitle').innerText())!=='Sin momentos',tag+' modo Favoritos');
 /* acción contextual navega por el flujo existente */
 await p.selectOption('#vmoMode','all');await p.evaluate(()=>ViveMomentos.state.pb.go(0));await p.waitForTimeout(100);
 ok(await p.locator('.vmo-action').isVisible(),tag+' acción contextual visible');
 await p.tap('.vmo-action');await p.waitForTimeout(900);ok(!(await p.evaluate(()=>ViveMomentos.isOpen)),tag+' acción cierra Momentos');
 /* cierre por botón, Escape, arrastre y retroceso */
 const reopen=async()=>{await compact(p);await p.tap('.vive-mobile-dock-center');await p.waitForTimeout(800)};
 await reopen();await p.tap('.vmo-ic[data-vmo=close]');await p.waitForTimeout(600);ok(!(await p.evaluate(()=>ViveMomentos.isOpen)),tag+' cierra con botón');
 await reopen();await p.keyboard.press('Escape');await p.waitForTimeout(600);ok(!(await p.evaluate(()=>ViveMomentos.isOpen)),tag+' cierra con Escape');
 await reopen();await p.evaluate(()=>{const g=document.querySelector('.vmo-grab');const o={bubbles:true,pointerId:1,clientX:100};g.dispatchEvent(new PointerEvent('pointerdown',Object.assign({clientY:100},o)));g.dispatchEvent(new PointerEvent('pointerup',Object.assign({clientY:200},o)))});await p.waitForTimeout(600);ok(!(await p.evaluate(()=>ViveMomentos.isOpen)),tag+' cierra deslizando');
 await reopen();await p.evaluate(()=>history.back());await p.waitForTimeout(700);ok(!(await p.evaluate(()=>ViveMomentos.isOpen)),tag+' cierra con retroceso');
 ok(await p.evaluate(()=>!ViveMomentos.state.raf),tag+' sin rAF tras cerrar');
 /* 30 ciclos: sin red nueva, sin listeners nuevos, sin rAF residual */
 const before=sb;await p.evaluate(()=>{window.__L=0;for(const t of [document,window,document.body]){const o=t.addEventListener;t.addEventListener=function(...a){window.__L++;return o.apply(this,a)}}const o2=EventTarget.prototype.addEventListener;});
 for(let i=0;i<30;i++){await p.evaluate(()=>ViveMomentos.open(document.querySelector('.vive-mobile-dock-center')||document.body));await p.waitForTimeout(60);await p.evaluate(()=>ViveMomentos.close());await p.waitForTimeout(60)}
 await p.waitForTimeout(500);
 const c=await p.evaluate(()=>({L:window.__L,raf:ViveMomentos.state.raf,dlg:document.querySelectorAll('dialog.vmo').length,open:ViveMomentos.isOpen}));
 ok(c.L===0,tag+' 30 ciclos sin listeners nuevos ('+c.L+')');ok(c.dlg===1&&!c.raf&&!c.open,tag+' un solo diálogo, sin rAF');ok(sb===before,tag+' 0 peticiones a Supabase al abrir/cerrar');
 ok(errs.length===0,tag+' sin errores de consola '+errs.join('|'));
 /* persistencia tras recarga */
 await p.reload();await p.waitForTimeout(800);ok(await p.evaluate(id=>JSON.parse(localStorage.getItem('vive.momentos.fav.v1')||'[]').includes(id),fid),tag+' favorito persiste tras recargar');
 await p.close();}
/* 3 · PC: panel inmersivo centrado */
{process.env.THEME='light';process.env.TOUCH='';const {p}=await open(b,1280,800);await p.waitForTimeout(500);
 await p.evaluate(()=>ViveMomentos.open());await p.waitForTimeout(700);
 const g=await p.evaluate(()=>{const r=document.querySelector('dialog.vmo').getBoundingClientRect();return {w:Math.round(r.width),centered:Math.abs((r.left+r.right)/2-innerWidth/2)<12,h:document.documentElement.scrollWidth>innerWidth}});
 ok(g.w<=540&&g.centered&&!g.h,'PC panel centrado '+JSON.stringify(g));
 await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);ok((await p.locator('#vmoTitle').innerText())!=='Atención requerida','PC: teclado → siguiente');
 await p.keyboard.press('Escape');await p.waitForTimeout(500);ok(!(await p.evaluate(()=>ViveMomentos.isOpen)),'PC: Escape cierra');await p.close()}
/* 4 · Sin datos: estado honesto */
{process.env.THEME='light';process.env.TOUCH='1';const {p}=await open(b,402,874);
 await p.evaluate(()=>{const d=window.__T.dbg();d.cards=[];d.loans=[];d.accounts=[];d.personalLoans=[];d.recurring=[];d.transactions=[];window.__T.inv()});
 await p.evaluate(()=>ViveMomentos.open(document.body));await p.waitForTimeout(700);
 ok((await p.locator('#vmoTitle').innerText())==='Datos pendientes','sin datos: "Datos pendientes", nunca "Todo tranquilo"');
 ok(!(await p.locator('dialog.vmo').innerText()).includes('Todo tranquilo'),'sin datos: no afirma tranquilidad');await p.close()}
await b.close();console.log(`momentos: OK (${n} comprobaciones)`)})().catch(e=>{console.error(e);process.exit(1)});
