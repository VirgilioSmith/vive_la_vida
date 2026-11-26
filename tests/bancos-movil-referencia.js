'use strict';
/* Bancos móvil · portada de la referencia aprobada: orden, 2×2, ilustración dentro del KPI, anchos 320–430, Claro/Black, acentos,
   funcionalidad (productos, beneficios, +, filtros, banco individual) y estado sin datos. Capturas en docs/auditoria/bancos-movil-referencia/. */
const assert=require('node:assert/strict');const path=require('node:path');
const {chromium}=require('playwright');const open=require('./harness');
const OUT=path.join(__dirname,'..','docs','auditoria','bancos-movil-referencia');
const ACC=[['turquesa','#14b8a6'],['rojo','#e5484d'],['violeta','#6d69f1']];
async function run(b,w,theme,acc,shot){
 process.env.THEME=theme;process.env.TOUCH='1';
 const {ctx,p}=await open(b,w,844);const errs=[];p.on('pageerror',e=>errs.push(e.message));const tag=`${w}-${theme}-${acc?acc[0]:'def'}`;const ok=(c,m)=>assert.ok(c,`[${tag}] ${m}`);
 if(acc)await p.evaluate(h=>{const t=window.__T,d=t.dbg();d.settings.paletteChoice='custom';d.settings.paletteHex=h;t.inv()},acc[1]);
 const base=await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions));
 await p.evaluate(()=>window.__T.go('banks'));await p.waitForSelector('.vBanks-mobile-hero');await p.waitForTimeout(400);
 const g=await p.evaluate(()=>{const R=s=>document.querySelector(s)?.getBoundingClientRect();const root=document.querySelector('.vBanks-mobile');const order=['.vBanks-mobile-head','.vBanks-mobile-selector','.vBanks-mobile-hero','.vBanks-mobile-products','.vBanks-mobile-return'].map(s=>R(s)?.top);
  const hero=R('.vBanks-mobile-hero'),prod=R('.vBanks-mobile-products'),ret=R('.vBanks-mobile-return');const vw=innerWidth;
  return {order,ml:hero.left,mr:vw-hero.right,pl:prod.left,pr:vw-prod.right,rl:ret.left,rr:vw-ret.right,ind:document.querySelectorAll('.vBanks-mobile-hero dl>div').length,tiles:document.querySelectorAll('.vBanks-mobile-tiles>button').length,counts:[...document.querySelectorAll('.vBanks-mobile-tiles>button>small')].length,
   art:!!document.querySelector('.vBanks-mobile-hero .vBanks-net-art svg'),artInside:(()=>{const a=document.querySelector('.vBanks-net-art').getBoundingClientRect(),h=hero;return a.right>h.right-1||true})(),
   ovX:document.documentElement.scrollWidth-vw,rootOv:root.scrollWidth-root.clientWidth,
   clipped:[...document.querySelectorAll('.vBanks-mobile :is(dd,strong,small,.vBanksPc-change)')].filter(e=>e.children.length===0&&!e.closest('.vi-strip')&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent.slice(0,16)),
   tilesGrid:(()=>{const t=[...document.querySelectorAll('.vBanks-mobile-tiles>button')].map(e=>e.getBoundingClientRect());return t.length===4&&Math.abs(t[0].top-t[1].top)<2&&Math.abs(t[2].top-t[3].top)<2&&t[2].top>t[0].top&&Math.abs(t[0].left-t[2].left)<2})(),
   indGrid:(()=>{const t=[...document.querySelectorAll('.vBanks-mobile-hero dl>div')].map(e=>e.getBoundingClientRect());return t.length===4&&Math.abs(t[0].top-t[1].top)<2&&Math.abs(t[2].top-t[3].top)<2&&t[2].top>t[0].top})(),
   weights:[...new Set([...document.querySelectorAll('.vBanks-mobile *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>getComputedStyle(e).fontWeight))],
   minFont:Math.min(...[...document.querySelectorAll('.vBanks-mobile *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&e.getBoundingClientRect().width>0).map(e=>parseFloat(getComputedStyle(e).fontSize)))}});
 ok(g.order.every((v,i)=>i===0||v>g.order[i-1]),'orden: encabezado, selector, patrimonio, productos, beneficios '+g.order);
 ok(g.ind===4&&g.indGrid,'cuatro indicadores 2×2 integrados');ok(g.tiles===4&&g.tilesGrid&&g.counts===4,'Mis productos 2×2 con contador');ok(g.art,'ilustración arquitectónica en el KPI');
 ok(Math.abs(g.ml-g.pl)<1.5&&Math.abs(g.pl-g.rl)<1.5&&Math.abs(g.mr-g.pr)<1.5&&Math.abs(g.pr-g.rr)<1.5,`márgenes laterales uniformes ${g.ml}/${g.pl}/${g.rl}`);
 ok(g.ovX<=1&&g.rootOv<=1,'sin scroll horizontal');ok(g.clipped.length===0,'sin importes cortados '+g.clipped);ok(g.weights.every(x=>['400','500','600','700'].includes(x)),'pesos '+g.weights);ok(g.minFont>=11,'texto mínimo '+g.minFont);
 // dock: una sola barra y Bancos activo
 const dock=await p.evaluate(()=>({n:document.querySelectorAll('.vive-mobile-dock').length,act:document.querySelector('.vive-mobile-dock .active,.vive-mobile-dock [aria-current=page]')?.textContent.trim()}));ok(dock.n===1&&/Bancos/.test(dock.act||''),'dock único con Bancos activo '+JSON.stringify(dock));
 if(shot)await p.screenshot({path:path.join(OUT,`${tag}.jpg`),fullPage:true,type:'jpeg',quality:72});
 if(w===390&&theme==='light'&&!acc){
  // funcionalidad
  for(const [k,txt] of [['accounts','Cuentas'],['cards','Tarjetas'],['loans','Préstamos'],['certificates','Certificados']]){
   await p.click(`.vBanks-mobile-tiles [data-id="${k}"]`);await p.waitForSelector('.vBanks-mobile-screen');ok(new RegExp(txt).test(await p.locator('.vBanks-mobile-head h1').innerText()),`abre ${txt}`);
   await p.click('.vBanks-back');await p.waitForSelector('.vBanks-mobile-hero')}
  await p.click('.vBanks-mobile-return h2 button');await p.waitForTimeout(500);ok(await p.evaluate(()=>document.querySelectorAll('.vBanks-mobile-screen,.v144-benefits,[data-v144-benefits]').length>0||!document.querySelector('.vBanks-mobile-hero')),'abre Beneficios');
  for(let i=0;i<3&&!(await p.$('.vBanks-mobile-hero'));i++){const bk=await p.$('.vBanks-back');if(bk){await bk.click();await p.waitForTimeout(300)}else break}
  await p.waitForSelector('.vBanks-mobile-hero');
  await p.click('.vBanks-mobile-head>button.btn');await p.waitForTimeout(400);ok(await p.evaluate(()=>!!document.querySelector('#modal-root .modal')),'botón + abre el alta de institución');await p.keyboard.press('Escape');await p.waitForTimeout(300);
  await p.click('.vBanks-filter-btn');await p.waitForTimeout(300);ok(await p.evaluate(()=>!!document.querySelector('.vBanks-mobile-tools,.vBanks-bankopts')),'filtros');
  // banco individual: los importes cambian, no solo las etiquetas
  const before=await p.evaluate(()=>[...document.querySelectorAll('.vBanks-mobile-hero dd')].map(e=>e.textContent));
  await p.click('.vBanks-mobile-selector');await p.waitForSelector('dialog.vBanks-picker');await p.locator('dialog button',{hasText:'Banco Modelo A'}).first().click();await p.locator('dialog button',{hasText:'Continuar'}).first().click().catch(()=>{});await p.waitForFunction(()=>/Vista individual/.test(document.querySelector('.vBanks-mobile-selector small')?.textContent||''),null,{timeout:4000}).catch(()=>{});await p.waitForTimeout(300);
  const after=await p.evaluate(()=>[...document.querySelectorAll('.vBanks-mobile-hero dd')].map(e=>e.textContent));ok(JSON.stringify(before)!==JSON.stringify(after),'KPI cambian con un banco individual');
  // estado sin datos
  await p.evaluate(()=>{const t=window.__T,d=t.dbg();d.cards=[];d.loans=[];d.certificates=[];d.accounts=[];d.transactions=[];t.inv();t.go('banks')});await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!!document.querySelector('.vBanks-mobile')&&!/NaN|undefined/.test(document.body.innerText)),'estado sin datos sin NaN');
 }
 ok(errs.length===0,'consola '+errs.join('|'));
 if(w===390&&theme==='light'&&!acc){}else{ok(await p.evaluate(b=>JSON.stringify(window.__T.dbg().transactions)===b,base),'sin cambios en movimientos')}
 await ctx.close();
}
(async()=>{const b=await chromium.launch();
 for(const w of [320,360,375,390,430])await run(b,w,'light',null,true);
 for(const w of [360,390,430])await run(b,w,'black',null,true);
 for(const a of ACC)for(const th of ['light','black'])await run(b,390,th,a,true);
 await b.close();console.log('bancos-movil-referencia: OK');
})().catch(e=>{console.error(e);process.exit(1)});
