/* VIVE · inteligencia de Frases: deduplicación léxico-semántica, ritmo y diversidad (Node + app real). */
const P=require('../src/phrases-intel.js');const {chromium}=require('playwright');const open=require('./harness.js');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,400))}};
/* --- unidad --- */
check('una frase idéntica o casi idéntica se detecta (≥ 0,85)',P.similarity('¿Estoy ahorrando para vivir o dejando de vivir para ahorrar?','¿Estás ahorrando para vivir o dejando de vivir para ahorrar?')>=.85);
check('la misma idea con otras palabras se detecta por familias de conceptos (≥ 0,6)',P.similarity('¿Ahorro todo y postergo vivir?','¿Estoy ahorrando para vivir o dejando de vivir para ahorrar?')>=.6);
check('frases distintas no se confunden (< 0,3)',P.similarity('Un abrazo vale más que un regalo.','Descansar también es avanzar.')<.3);
check('«Siempre joseando» y «Joseando por lo mío» no se consideran la misma frase (< 0,6)',P.similarity('Siempre joseando.','Joseando por lo mío.')<.6);
let rec=[];rec=P.remember(rec,'Vive el hoy sin prisa.','hoy','2026-11-26');
check('rechaza una frase similar a una reciente',P.ok('Vive hoy, sin prisa.','hoy',rec).ok===false);
check('acepta una frase distinta',P.ok('Agradece a quien te acompaña.','gratitud',rec).ok===true);
const r3=['Texto breve.','Otro texto con palabras distintas aquí y un poco más de longitud para variar el ritmo de lectura.','Un tercer mensaje diferente por completo que, además, resulta bastante más largo que los demás para el ritmo.'].reduce((r,t)=>P.remember(r,t,'paz','d'),[]);
check('no permite el mismo tema tres veces seguidas',P.ok('Cuarto mensaje con otra idea.','paz',r3).ok===false&&P.ok('Cuarto mensaje con otra idea.','familia',r3).ok===true);
check('una frase idéntica se rechaza hasta 60 apariciones después (aunque sea de otro tema)',P.ok('Vive el hoy sin prisa.','otro',rec).ok===false);
check('diversidad: sin datos suficientes devuelve null (no inventa métricas)',P.diversity([])===null);
/* --- banco real y rotación --- */
(async()=>{const b=await chromium.launch();const errs=[];const {p}=await open(b,390,844);p.on('pageerror',e=>errs.push(e.message));
 await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(1200);
 const au=await p.evaluate(()=>{const b=window.__vivePhrases.bank();return window.VivePhrases.audit(b)});
 console.log(`   banco: ${au.total} frases, ${Object.keys(au.themes).length} temas, ${au.near.length} pares muy parecidos (${au.exact} idénticos)`);
 check('auditoría del banco real: se mide (≥ 300 frases)',au.total>=300,au.total);
 const rot=await p.evaluate(()=>{const out=[];for(let i=0;i<150;i++){const x=window.__vivePhrases.next();out.push({t:x.text,th:x.theme})}return out});
 let close=0,worst=0;for(let i=0;i<rot.length;i++)for(let j=Math.max(0,i-12);j<i;j++){const s=P.similarity(rot[i].t,rot[j].t);if(s>=.75)close++;worst=Math.max(worst,s)}
 check(`150 frases consecutivas: ninguna casi idéntica a las 12 anteriores (peor similitud ${worst.toFixed(2)})`,close===0,close);
 let triple=0;for(let i=2;i<rot.length;i++)if(rot[i].th&&rot[i].th===rot[i-1].th&&rot[i].th===rot[i-2].th&&rot[i].th!=='bienestar'&&rot[i].th!=='joseo')triple++;
 check('sin el mismo tema tres veces seguidas (fuera de los espacios fijos)',triple===0,triple);
 const div=await p.evaluate(()=>window.__vivePhrases.diversity());check('diversidad medida con datos reales (temas distintos y similitud media baja)',div&&div.temas>=2&&div.similitudMedia<.25,div);
 check('las frases no dependen de datos financieros (el módulo no lee transacciones)',!/transactions|db\./.test(require('fs').readFileSync(__dirname+'/../src/phrases-intel.js','utf8')));
 check('sin errores de página',errs.length===0,errs);
 console.log(`\nFRASES INTELIGENCIA: ${ok} verificaciones aprobadas${bad?`, ${bad} FALLARON`:''}`);await b.close();process.exit(bad?1:0)})();
