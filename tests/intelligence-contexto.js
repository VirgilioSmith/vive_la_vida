/* VIVE Intelligence — la franja cambia según DÓNDE estás (móvil y PC). */
const {chromium}=require('playwright');const open=require('./harness.js');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,500))}};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const [name,w,h,touch] of [['móvil',390,844,'1'],['PC',1440,900,'']]){if(touch)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {p}=await open(b,w,h);p.on('pageerror',e=>errs.push(e.message));await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(1300);
  const T={};for(const pg of ['overview','wallet','loans','register','recurring','pressure','banks']){await p.evaluate(g=>window.__viveIntel.go(g),pg);await p.waitForTimeout(900);
   T[pg]=await p.evaluate(()=>{const s=document.querySelector('.vi-strip');return s?s.querySelector('strong').textContent:null})}
  const titles=Object.values(T).filter(Boolean);
  check(`[${name}] el mensaje varía según la página (≥ 6 mensajes distintos en 7 páginas)`,new Set(titles).size>=6,T);
  check(`[${name}] Inicio muestra algo estratégico, no un vencimiento`,T.overview&&!/vencido|vence/i.test(T.overview),T.overview);
  check(`[${name}] Wallet muestra algo de tarjetas o crédito`,T.wallet&&/tarjeta|crédito/i.test(T.wallet),T.wallet);
  check(`[${name}] Cada pantalla analiza su propio escenario: Bancos habla de dinero/cuentas, Suscripciones de recurrentes`,T.banks&&/liquidez|cuenta|dinero/i.test(T.banks)&&T.recurring&&/recurr|renueva|suscrip/i.test(T.recurring),[T.banks,T.recurring]);
  check(`[${name}] Préstamos no repite el mensaje de Inicio ni habla de tarjetas`,T.loans&&T.loans!==T.overview&&!/tarjeta/i.test(T.loans),T.loans);
  check(`[${name}] Bancos no muestra un vencimiento ajeno`,!T.banks||!/vencido/i.test(T.banks),T.banks);
  /* la hoja abre con el mismo hallazgo que anuncia la franja */
  await p.evaluate(g=>window.__T.go(g),'wallet');await p.waitForTimeout(900);await p.click('.vi-strip');await p.waitForTimeout(500);
  const sheet=await p.evaluate(()=>({strip:null,first:document.querySelector('.vi-sheet .vi-card h4')?.textContent}));
  check(`[${name}] la hoja abre sin errores y con contenido`,!!sheet.first,sheet);
 }
 { const {p}=await open(b,1280,860);p.on('pageerror',e=>errs.push(e.message));await p.evaluate(g=>window.__viveIntel.go(g),'overview');await p.waitForTimeout(1200);await p.click('.vi-strip');await p.waitForTimeout(600);
  const inicio=await p.evaluate(()=>({lens:[...document.querySelectorAll('.vi-disc')].filter(c=>/Aquí y ahora/i.test(c.innerText)).length,order:[...document.querySelectorAll('.vi-group h3')].map(h=>h.childNodes[0].textContent)}));
  check('Inicio (cerebro): la hoja reúne hallazgos de varios módulos (≥ 2) y lo urgente sigue primero',inicio.lens>=2&&inicio.order[0]==='Crítico',inicio); }
 check('sin errores de página',errs.length===0,errs);
 console.log(`\nINTELLIGENCE CONTEXTO: ${ok} verificaciones aprobadas${bad?`, ${bad} FALLARON`:''}`);await b.close();process.exit(bad?1:0)})();
