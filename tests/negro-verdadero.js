/* Modo Black: negro verdadero. Mide píxeles reales de los márgenes (sin tarjetas) y busca controles claros residuales en todas las páginas. */
const {chromium}=require('playwright');const open=require('./harness');const assert=require('assert');
(async()=>{const b=await chromium.launch();process.env.THEME='black';process.env.TOUCH='1';
for(const w of [320,402,430]){const {p}=await open(b,w,874);
 const bg=await p.evaluate(()=>getComputedStyle(document.body).backgroundColor);assert.strictEqual(bg,'rgb(0, 0, 0)','body #000 '+bg);
 for(const g of ['overview','wallet','banks','mobilehub','mobilesearch','register','flow','patrimony','budget','categories','recurring','personal','settings']){
  await p.evaluate(x=>window.__T.go(x),g);await p.waitForTimeout(450);
  const light=await p.evaluate(()=>{const o=[];for(const e of document.querySelectorAll('#app *')){const r=e.getBoundingClientRect();if(r.width<28||r.height<28||r.top>innerHeight||r.bottom<0||r.width>=innerWidth-4)continue;if(e.closest('.v41-service-mark,.bank-photo-mark,img,svg'))continue;const s=getComputedStyle(e),m=s.backgroundColor.match(/rgba?\(([^)]+)\)/);if(!m)continue;const [R,G,B,A=1]=m[1].split(',').map(Number);if(A>.5&&(R+G+B)/3>150)o.push((e.className||e.tagName).toString().slice(0,30))}return o});
  assert.strictEqual(light.length,0,`${w} ${g}: controles claros en Black: ${light.join(', ')}`);
 }
 await p.close()}
await b.close();console.log('negro-verdadero: OK')})().catch(e=>{console.error(e.message);process.exit(1)});
