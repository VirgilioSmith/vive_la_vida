/* Centro Estratégico: cápsula central del dock compacto (Inicio | mensaje de dos palabras | Buscar). */
const {chromium}=require('playwright');const open=require('./harness');const assert=require('assert');
(async()=>{const b=await chromium.launch();process.env.TOUCH='1';
const comp=async p=>{await p.evaluate(()=>window.scrollTo(0,0));for(let i=0;i<5;i++){await p.mouse.wheel(0,120);await p.waitForTimeout(60)}await p.waitForTimeout(500)};
const info=p=>p.evaluate(()=>{const d=document.querySelector('.vive-mobile-dock'),c=d.querySelector('.vive-mobile-dock-center'),s=c.querySelector('strong');const r=c.getBoundingClientRect(),a=d.querySelector('[aria-label=Inicio]').getBoundingClientRect(),z=d.querySelector('[aria-label=Buscar]').getBoundingClientRect();return {compact:d.classList.contains('is-compact'),title:s.textContent.trim(),words:s.textContent.trim().split(/\s+/).length,ovf:s.scrollWidth>s.clientWidth+1,inside:r.left>=a.right-1&&r.right<=z.left+1&&z.right<=innerWidth,h:document.documentElement.scrollWidth>innerWidth,label:c.getAttribute('aria-label'),go:c.dataset.id||'',vis:[...d.querySelectorAll('.vive-mobile-dock-item')].filter(x=>getComputedStyle(x).opacity!=='0').length}});
for(const theme of ['light','black'])for(const w of [320,360,375,390,430]){process.env.THEME=theme;const {p}=await open(b,w,874);const tag=`${theme}-${w}`;
 await p.evaluate(()=>window.__T.go('wallet'));await p.waitForTimeout(500);
 let i=await info(p);assert.ok(!i.compact,tag+' expandido arriba');
 await comp(p);i=await info(p);
 assert.ok(i.compact,tag+' compacto al desplazar');assert.strictEqual(i.words,2,tag+' dos palabras: '+i.title);assert.ok(!i.ovf&&i.inside&&!i.h,tag+' sin desbordes');assert.strictEqual(i.vis,2,tag+' solo Inicio y Buscar a los lados');assert.ok(/Centro estratégico/.test(i.label),tag+' aria-label');
 assert.ok(i.go,tag+' alerta real con destino ('+i.title+')');
 await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForTimeout(400);await p.evaluate(()=>window.scrollTo(0,0));
 await p.mouse.wheel(0,600);await p.waitForTimeout(500);await p.tap('.vive-mobile-dock-center');await p.waitForTimeout(600);
 assert.ok((await p.evaluate(()=>document.querySelector('.vive-mobile-dock [aria-current]')?.getAttribute('aria-label')))==='Wallet',tag+' toca alerta -> Wallet');
 await p.evaluate(()=>{const d=window.__T.dbg();d.cards=[];d.loans=[];d.personalLoans=[];d.recurring=[];d.transactions=[];window.__T.inv()});
 await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForTimeout(500);await comp(p);i=await info(p);
 assert.ok(!i.go&&i.words===2&&!i.ovf&&i.inside,tag+' sin alertas: frase de dos palabras sin acción ('+i.title+')');
 await p.tap('.vive-mobile-dock-center');await p.waitForTimeout(500);assert.ok(!(await info(p)).compact,tag+' tocar frase expande');
 await p.close?.();}
await b.close();console.log('centro-estrategico: OK');})().catch(e=>{console.error(e);process.exit(1)});
