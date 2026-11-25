/* Centro Estratégico: cápsula del dock compacto (Inicio | mensaje | Buscar) que abre Momentos. */
const {chromium}=require('playwright');const open=require('./harness');const assert=require('assert');
(async()=>{const b=await chromium.launch();process.env.TOUCH='1';
const comp=async p=>{await p.evaluate(()=>window.scrollTo(0,0));for(let i=0;i<5;i++){await p.mouse.wheel(0,120);await p.waitForTimeout(60)}await p.waitForTimeout(500)};
const info=p=>p.evaluate(()=>{const d=document.querySelector('.vive-mobile-dock'),c=d.querySelector('.vive-mobile-dock-center'),s=c.querySelector('strong');const r=c.getBoundingClientRect(),a=d.querySelector('[aria-label=Inicio]').getBoundingClientRect(),z=d.querySelector('[aria-label=Buscar]').getBoundingClientRect();return {compact:d.classList.contains('is-compact'),title:s.textContent.trim(),words:s.textContent.trim().split(/\s+/).length,ovf:s.scrollWidth>s.clientWidth+1,inside:r.left>=a.right-1&&r.right<=z.left+1&&z.right<=innerWidth,h:document.documentElement.scrollWidth>innerWidth,sub:c.querySelector('small').textContent,vis:[...d.querySelectorAll('.vive-mobile-dock-item')].filter(x=>getComputedStyle(x).opacity!=='0').length}});
for(const theme of ['light','black'])for(const w of [320,360,375,390,430]){process.env.THEME=theme;const {p}=await open(b,w,874);const tag=`${theme}-${w}`;
 await p.evaluate(()=>window.__T.go('wallet'));await p.waitForTimeout(500);
 let i=await info(p);assert.ok(!i.compact,tag+' expandido arriba');
 await comp(p);i=await info(p);
 assert.ok(i.compact,tag+' compacto al desplazar');assert.strictEqual(i.words,2,tag+' dos palabras: '+i.title);assert.ok(!i.ovf&&i.inside&&!i.h,tag+' sin desbordes');assert.strictEqual(i.vis,2,tag+' solo Inicio y Buscar a los lados');assert.strictEqual(i.sub,'Tu centro estratégico',tag+' subtítulo');
 assert.strictEqual(i.title,'Atención requerida',tag+' alerta real vencida tiene prioridad sobre frases');
 await p.evaluate(()=>{const d=window.__T.dbg();d.cards=[];d.loans=[];d.personalLoans=[];d.recurring=[];d.transactions=[];window.__T.inv()});
 await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForTimeout(500);await comp(p);i=await info(p);
 assert.ok(i.words===2&&!i.ovf&&i.inside,tag+' sin datos: dos palabras sin desborde ('+i.title+')');
 assert.notStrictEqual(i.title,'Todo tranquilo',tag+' sin datos verificados no dice "Todo tranquilo" ('+i.title+')');
 await p.tap('.vive-mobile-dock-center');await p.waitForTimeout(700);
 assert.ok(await p.evaluate(()=>window.ViveMomentos.isOpen),tag+' tocar la cápsula abre Momentos');
 await p.close();}
await b.close();console.log('centro-estrategico: OK');})().catch(e=>{console.error(e);process.exit(1)});
