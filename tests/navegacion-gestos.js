/* Navegación universal por gestos: ambos laterales, completos/incompletos, rápidos/lentos, vertical, modales, sin historial, doble retroceso, PC. */
const {chromium}=require('playwright');const open=require('./harness');const assert=require('assert');
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++};
async function swipe(p,cdp,x0,y0,dx,dy,steps,ms){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]});for(let i=1;i<=steps;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+dx*i/steps,y:y0+dy*i/steps}]});if(ms)await p.waitForTimeout(ms/steps)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(650)}
const page=p=>p.evaluate(()=>window.__T.ui().page);
(async()=>{const b=await chromium.launch();process.env.TOUCH='1';
for(const theme of ['light','black']){process.env.THEME=theme;const {p}=await open(b,402,874);const tag=theme;
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));let sb=0;p.on('request',q=>{if(/supabase\.co/.test(q.url()))sb++});
 const cdp=await p.context().newCDPSession(p);
 const goDeep=async()=>{await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForTimeout(300);await p.evaluate(()=>window.__T.go('budget'));await p.waitForTimeout(500)};
 /* pantalla raíz sin historial: no hace nada */
 await p.evaluate(()=>window.__T.go('wallet'));await p.waitForTimeout(400);await swipe(p,cdp,6,400,230,0,12,120);ok((await page(p))==='wallet',tag+' raíz: sin acción');
 /* lateral izquierdo completo y lento */
 await goDeep();ok((await page(p))==='budget',tag+' en Presupuesto');await swipe(p,cdp,6,420,240,4,14,260);ok((await page(p))==='mobilehub',tag+' izquierda → regresa a Explorar ('+await page(p)+')');
 /* lateral derecho completo */
 await goDeep();await swipe(p,cdp,396,300,-240,-6,14,260);ok((await page(p))==='mobilehub',tag+' derecha → regresa');
 /* incompleto: vuelve a su sitio */
 await goDeep();await swipe(p,cdp,6,420,60,0,8,300);ok((await page(p))==='budget',tag+' gesto incompleto cancela');
 ok(await p.evaluate(()=>{const m=document.querySelector('#app main.main');return !m.style.transform||m.style.transform==='none'||m.style.transform===''}),tag+' sin transform residual');
 /* rápido y corto */
 await p.evaluate(async()=>{const fire=(t,x)=>document.dispatchEvent(new PointerEvent(t,{pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:500,bubbles:true,cancelable:true}));const raf=()=>new Promise(r=>requestAnimationFrame(r));const tgt=document.elementFromPoint(396,500)||document.body;const d=(t,x)=>tgt.dispatchEvent(new PointerEvent(t,{pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:500,bubbles:true,cancelable:true}));d('pointerdown',396);await raf();d('pointermove',378);await raf();d('pointermove',352);await raf();d('pointermove',322);d('pointerup',322)});await p.waitForTimeout(700);ok((await page(p))==='mobilehub',tag+' gesto rápido (fling ≈1,4 px/ms) regresa');
 /* vertical en el borde: no navega */
 await goDeep();await swipe(p,cdp,6,300,10,260,10,200);ok((await page(p))==='budget',tag+' vertical no navega');
 /* arranque fuera de la zona lateral: no navega */
 await swipe(p,cdp,120,420,240,0,12,200);ok((await page(p))==='budget',tag+' fuera del borde no navega');
 /* doble retroceso: dos niveles, un gesto = un paso */
 await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForTimeout(300);await p.evaluate(()=>window.__T.go('categories'));await p.waitForTimeout(300);await p.evaluate(()=>window.__T.go('budget'));await p.waitForTimeout(400);
 const before=await p.evaluate(()=>0);await swipe(p,cdp,6,420,250,0,12,200);const mid=await page(p);ok(mid!=='budget'&&mid!=='mobilehub'||mid==='categories','tag '+tag+' un gesto = un paso ('+mid+')');
 /* modal con formulario sin cambios se cierra; con cambios se respeta */
 await p.evaluate(()=>window.__T.go('wallet'));await p.waitForTimeout(400);
 await p.evaluate(()=>document.querySelector('.v249-register-fab').click());await p.waitForTimeout(600);
 ok(await p.evaluate(()=>document.getElementById('modal-root').children.length>0),tag+' modal abierto');
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#modal-root button')].find(x=>/gasto|egreso/i.test(x.textContent));b&&b.click()});await p.waitForTimeout(700);
 const hadInput=await p.evaluate(()=>{const i=[...document.querySelectorAll('#modal-root input:not([type=hidden]):not([type=checkbox]):not([type=radio])')].find(x=>x.offsetParent);if(i){i.value='12345';i.dispatchEvent(new Event('input',{bubbles:true}));return true}return false});ok(hadInput,tag+' formulario con campo para probar cambios pendientes');
 await swipe(p,cdp,6,400,240,0,12,200);ok(await p.evaluate(()=>document.getElementById('modal-root').children.length>0),tag+' formulario con cambios: protegido');
 await p.evaluate(()=>{const c=document.querySelector('#modal-root [data-act=closeModal],#modal-root .fastx-close');c&&c.click()});await p.waitForTimeout(500);
 await p.evaluate(()=>document.querySelector('.v249-register-fab').click());await p.waitForTimeout(600);
 await swipe(p,cdp,396,400,-240,0,12,200);ok(await p.evaluate(()=>document.getElementById('modal-root').children.length===0),tag+' modal sin cambios: se cierra con el gesto');
 /* preferencia desactivada */
 await goDeep();await p.evaluate(()=>window.ViveUniversalNavigation.setPrefs({enabled:false}));await swipe(p,cdp,6,420,240,0,12,200);ok((await page(p))==='budget',tag+' gesto desactivado');
 await p.evaluate(()=>window.ViveUniversalNavigation.setPrefs({enabled:true,sides:'left'}));await swipe(p,cdp,396,420,-240,0,12,200);ok((await page(p))==='budget',tag+' solo izquierda: derecha ignorada');
 await swipe(p,cdp,6,420,240,0,12,200);ok((await page(p))==='mobilehub',tag+' solo izquierda: izquierda funciona');
 await p.evaluate(()=>window.ViveUniversalNavigation.setPrefs({sides:'both'}));
 /* sección de ajustes */
 await p.evaluate(()=>window.__T.go('personalize'));await p.waitForTimeout(500);ok(await p.locator('#vnav-settings').count()===1,tag+' sección Navegación y gestos en Personalización');
 ok(sb===0,tag+' sin peticiones a Supabase ('+sb+')');ok(errs.length===0,tag+' sin errores de consola '+errs.join('|'));
 await p.close()}
/* PC: el ratón no se intercepta */
{process.env.THEME='light';process.env.TOUCH='';const {p}=await open(b,1280,800);await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForTimeout(300);await p.evaluate(()=>window.__T.go('budget'));await p.waitForTimeout(400);
 await p.mouse.move(4,400);await p.mouse.down();await p.mouse.move(400,400,{steps:10});await p.mouse.up();await p.waitForTimeout(500);ok((await page(p))==='budget','PC: el ratón no dispara el gesto');await p.close()}
await b.close();console.log(`navegacion-gestos: OK (${n} comprobaciones)`)})().catch(e=>{console.error(e.message);process.exit(1)});
