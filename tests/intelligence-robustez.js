/* VIVE Intelligence — robustez: entradas corruptas, extremas o incompletas NO deben romper ningún motor (fuzz reproducible) + exactitud de las cifras. */
const S=require('../src/intelligence/stats.js');const D=require('../src/intelligence/discovery.js');const G=require('../src/intelligence/strategy.js');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,500))}};
const T='2026-11-25';const dms=d=>Date.parse(d+'T00:00:00Z');const addDays=(d,n)=>new Date(dms(d)+n*86400000).toISOString().slice(0,10);
function ledger(seed,days=240){const R=S.rng(seed),out=[];const start=addDays(T,-days);for(let i=0;i<days;i++){const d=addDays(start,i);if(R()<.7)for(let k=0;k<2;k++)out.push({d,a:Math.round(1500*Math.exp((R()-.5))),k:'x',c:'Alimentación',l:'Compra '+Math.floor(R()*4),p:R()<.4?'c':'a'});if(i%14===0)out.push({d,a:40000,k:'i',c:'Salario',l:'Nómina',p:'a'})}return out}
const months=n=>Array.from({length:n+1},(_,i)=>({ym:'m'+i,partial:i===n,income:100000,expense:60000,interest:200,txCount:20,expenseBy:{Vivienda:30000,Ocio:20000,Comida:10000}}));
const base=()=>({today:T,fx:60,position:{liquid:300000,assets:600000,debt:200000,net:400000,series:[{ym:'a',net:1},{ym:'b',net:2},{ym:'c',net:3},{ym:'d',net:4}]},cardDebtDop:50000,loanInstallmentsDop:12000,recurringMonthlyDop:5000,
 cards:[{id:'c1',name:'Visa',limit:100000,limitDop:100000,debt:50000,debtDop:50000,util:50}],cardsNoLimit:[],loans:[{id:'l1',name:'Auto',balanceDop:300000,installmentDop:12000,rate:12}],
 accounts:[{id:'a1',name:'P',kind:'checking',balanceDop:200000},{id:'a2',name:'A',kind:'savings',balanceDop:100000}],upcoming:[{name:'Tarjeta',kind:'card',days:3,amountDop:20000},{name:'Préstamo',kind:'loan',days:5,amountDop:12000}],
 recurring:[{name:'Seguro',monthlyDop:3000},{name:'Stream',monthlyDop:2000}],annualCharges:[],months:months(8),ledger:ledger(1),cardPay90:60000,uncategorized:3});
/* mutadores de corrupción */
const BAD=[undefined,null,NaN,Infinity,-Infinity,'abc','',-5,0,1e15,[],{},true];
function mutate(R){const s=base();const paths=[['position','liquid'],['position','assets'],['position','debt'],['position','net'],['position'],['cardDebtDop'],['loanInstallmentsDop'],['recurringMonthlyDop'],['cards'],['loans'],['accounts'],['upcoming'],['recurring'],['months'],['ledger'],['cardPay90'],['uncategorized'],['today'],['fx'],['annualCharges']];
 const n=1+Math.floor(R()*3);for(let i=0;i<n;i++){const p=paths[Math.floor(R()*paths.length)];const v=BAD[Math.floor(R()*BAD.length)];if(p.length===2){if(s[p[0]]&&typeof s[p[0]]==='object')s[p[0]][p[1]]=v}else s[p[0]]=v}
 if(R()<.4&&Array.isArray(s.ledger)){for(let i=0;i<20;i++){const e=s.ledger[Math.floor(R()*s.ledger.length)];if(!e)continue;const f=['d','a','k','p'][Math.floor(R()*4)];e[f]=BAD[Math.floor(R()*BAD.length)]}}
 if(R()<.3&&Array.isArray(s.ledger))s.ledger=s.ledger.concat(s.ledger.slice(0,30));            /* duplicados */
 if(R()<.2&&Array.isArray(s.ledger))s.ledger.push({d:addDays(T,30),a:99999,k:'x'});            /* fecha futura */
 return s}
let thrown=0,engErr=0,badShape=0,first=null;const R=S.rng(777);const N=Number(process.env.FUZZ_N||250);let maxMs=0;
for(let i=0;i<N;i++){const s=mutate(R);const t0=Date.now();
 try{const r=D.discover(s,{});maxMs=Math.max(maxMs,Date.now()-t0);
  if(r.audit.engines.some(e=>e.error)){engErr++;if(!first)first=r.audit.engines.filter(e=>e.error).map(e=>e.id+': '+e.error)}
  if(!Array.isArray(r.discoveries)||!Array.isArray(r.internal)||typeof r.lens!=='object'||!Array.isArray(r.digest)||r.discoveries.some(h=>!h.title||!h.summary||!h.confidence))badShape++;
  const a=D.strategic(s,{});for(const f of [()=>a.horizon(),()=>a.decisionLab(),()=>a.lifeModel(),()=>a.graph(),()=>a.curiosity(),()=>a.chain({monthly:5000,down:0})])f()}
 catch(e){thrown++;if(!first)first=String(e&&e.stack||e).slice(0,300)}}
check(`fuzz (${N} entradas corruptas): ninguna excepción escapa de discover() ni de la API estratégica`,thrown===0,first);
check(`fuzz: ningún motor falla internamente (errores por motor: ${engErr})`,engErr===0,first);
check(`fuzz: la forma del resultado se conserva siempre (${badShape} malformados)`,badShape===0);
check(`fuzz: tiempo máximo por evaluación < 400 ms (${maxMs} ms)`,maxMs<400,maxMs);
check('fuzz: determinismo (misma entrada corrupta → mismo resultado)',(()=>{const R2=S.rng(5);const s=mutate(R2);return JSON.stringify(D.discover(s,{}).discoveries.map(h=>h.key))===JSON.stringify(D.discover(JSON.parse(JSON.stringify(s)),{}).discoveries.map(h=>h.key))})());
check('fuzz: nunca se muestran NaN, Infinity ni «undefined» en el texto de los hallazgos',(()=>{const R3=S.rng(99);let badTxt=0;for(let i=0;i<120;i++){const r=D.discover(mutate(R3),{});for(const h of [...r.discoveries,...Object.values(r.lens).flat()])if(/NaN|Infinity|undefined|\[object/.test(h.title+h.summary))badTxt++}return badTxt===0})());
/* exactitud de las cifras (lo que Vive dice == lo que se calcula) */
{const s=base();const F=D.buildFeatures(s,D.Memory.empty());const lz=G.lens(F,s,D.confidence);const by=t=>lz.find(x=>x.type===t);
 const hi=by('card-utilization');check('exactitud: «utilización» coincide con deuda ÷ límite',hi&&hi.evidence.find(e=>e[0]==='Utilización')[1]==='50 %');
 check('prescripción de tarjeta: el pago propuesto deja la utilización exactamente en 30 %',(()=>{const m=hi.prescription.match(/RD\$([\d.,]+)/);const pay=Number(m[1].replace(/[.,]/g,''));return Math.abs((50000-pay)/100000-.3)<.0005})(),hi&&hi.prescription);
 const lp=by('loan-horizon');check('prescripción de préstamo: el ahorro propuesto es positivo y la tasa/supuesto se declaran',lp&&/ahorraría ≈ RD\$/.test(lp.prescription)&&/tasa 12/.test(lp.prescriptionBasis),lp&&lp.prescription);
 const nper=(B,P,r)=>-Math.log(1-r*B/P)/Math.log(1+r);const r=.01;const n0=nper(300000,12000,r),n1=nper(300000,14500,r);check('prescripción de préstamo: la cifra coincide con la fórmula de amortización (independiente)',(()=>{const m=lp.prescription.match(/≈ (\d+) cuotas antes y ahorraría ≈ RD\$([\d.,]+)/);if(!m)return false;const k=Number(m[1]),sv=Number(m[2].replace(/[.,]/g,''));const E=Math.max(500,Math.round(12000*.2/500)*500);const n1b=nper(300000,12000+E,r);return k===Math.round(n0-n1b)&&Math.abs(sv-(12000*n0-(12000+E)*n1b))<2})(),[lp&&lp.prescription,n0,n1]);
 const dep=by('card-dependence');check('exactitud: dependencia de tarjetas = proporción real del libro mayor',(()=>{const led=s.ledger.filter(e=>e.k==='x'&&e.a>0&&e.d>=addDays(T,-89));const t=S.sum(led.map(e=>e.a)),c=S.sum(led.filter(e=>e.p==='c').map(e=>e.a));return dep&&dep.evidence[0][1]===Math.round(100*c/t)+' %'})(),dep&&dep.evidence);
 check('contexto universal: el hallazgo de Wallet incorpora la liquidez global («cubre N× tu deuda de tarjetas»)',/cubre [\d.]+× tu deuda de tarjetas/.test(hi.summary)||/cubre [\d.]+× tu deuda de tarjetas/.test((by('card-dependence')||{}).summary||''),hi.summary);
 const cov=by('liquidity-coverage');check('contexto universal: el de Bancos relaciona compromisos de 30 días con la liquidez',cov&&/próximos 30 días/.test(lz.find(x=>x.lens==='banks').summary)||lz.some(x=>x.lens==='banks'&&/próximos 30 días/.test(x.summary)));
 const risky=base();risky.position.liquid=20000;risky.cards[0].util=3;risky.cards[0].debtDop=3000;risky.cards[0].debt=3000;const F2=D.buildFeatures(risky,D.Memory.empty());const l2=G.lens(F2,risky,D.confidence);
 check('coherencia: no se celebra el «margen de crédito» cuando la liquidez cubre menos de un mes',!l2.some(x=>x.type==='credit-headroom')&&l2.some(x=>x.type==='liquidity-coverage'&&x.valence==='risk'),l2.map(x=>x.type));
 const r1=D.discover(s,{});check('Inicio (cerebro): el resumen transversal reúne lo más relevante de varios módulos, uno por módulo, máx. 4',r1.digest.length>=2&&r1.digest.length<=4&&new Set(r1.digest.map(h=>h.lens)).size===r1.digest.length,r1.digest.map(h=>h.lens));}
console.log(`\nINTELLIGENCE ROBUSTEZ: ${ok} verificaciones aprobadas${bad?`, ${bad} FALLARON`:''}`);process.exit(bad?1:0);
