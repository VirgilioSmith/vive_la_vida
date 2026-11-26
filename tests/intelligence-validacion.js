/* VIVE Intelligence — validación con VERDAD CONOCIDA: se planta un fenómeno en datos sintéticos y se mide cuántas veces se descubre (recall) y cuántas veces se «descubre» algo que no existe (falsos positivos). Semillas fijas. */
const S=require('../src/intelligence/stats.js');const D=require('../src/intelligence/discovery.js');
const T='2026-11-25';const dms=d=>Date.parse(d+'T00:00:00Z');const ad=(d,n)=>new Date(dms(d)+n*86400000).toISOString().slice(0,10);
function gen(seed,{days=280,fri=1,shiftFrom=null,shift=1,trend=0,habit=false,stopIncome=0,sub=false,pay=1}={}){const R=S.rng(seed),L=[];const st=ad(T,-days);
 for(let i=0;i<days;i++){const d=ad(st,i);const w=new Date(dms(d)).getUTCDay();let m=(1+trend*i)*(w===5?fri:1)*(shiftFrom!=null&&i>=shiftFrom?shift:1);
  if(R()<.7)for(let k=0;k<2;k++)L.push({d,a:Math.max(60,Math.round(1500*m*Math.exp((R()-.5)*.8))),k:'x',c:'A',l:'c'+Math.floor(R()*6),p:R()<.4?'c':'a'});
  if(habit&&i>=days-42&&i%6===0)L.push({d,a:22000,k:'x',c:'Ocio',l:'Evento',p:'a'});
  if(i%14===0&&!(stopIncome&&i>days-1-stopIncome))L.push({d,a:40000,k:'i',c:'S',l:'N',p:'a'});
  if(sub&&i%30===3&&i<days-70)L.push({d,a:899,k:'x',c:'Suscripciones',l:'Streamify',p:'c'})}
 return L}
const snap=L=>({today:T,fx:60,position:{liquid:3e5,assets:3e5,debt:0,net:3e5},cardDebtDop:0,loanInstallmentsDop:0,upcoming:[],months:[],ledger:L});
const raise=s=>{const a=D.discover(snap(s),{});const m=JSON.parse(JSON.stringify(a.mem));for(const k of Object.keys(m.hyp))m.hyp[k].seen=[ad(T,-1)];const b=D.discover(snap(s),m);const all=[...a.discoveries,...a.internal];const vis=b.discoveries;return {all,vis}};
const types=r=>new Set(r.all.map(h=>h.type)),vtypes=r=>new Set(r.vis.map(h=>h.type));

let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,400))}};
const N=Number(process.env.VAL_N||20),NN=Number(process.env.VAL_NULL||40);
const sc={fri:[{fri:3.4},['weekday-peak'],'día de la semana con gasto triple (viernes ×3,4)'],shift:[{shiftFrom:210,shift:1.5},['structural-up','slow-trend'],'cambio de nivel +50 % en las últimas 10 semanas'],trend:[{trend:.008},['structural-up','slow-trend'],'deriva lenta del gasto (+0,8 %/día)'],
 habit:[{habit:true},['exception-to-habit'],'excepción (gasto de RD$22.000) que se repite cada 6 días'],income:[{stopIncome:26},['income-late'],'el ingreso quincenal se retrasa 26 días'],sub:[{sub:true},['recurring-stopped'],'suscripción mensual que deja de cobrarse']};
console.log('\nVALIDACIÓN CON VERDAD CONOCIDA (datos sintéticos con el fenómeno plantado; semillas fijas)');
const res={};
for(const [k,[o,want,desc]] of Object.entries(sc)){let hit=0,anyHyp=0;for(let s=1;s<=N;s++){const r=raise(gen(100+s,o));if(r.vis.some(h=>want.includes(h.type)))hit++;if(r.all.some(h=>want.includes(h.type)))anyHyp++}res[k]=hit/N;console.log(`  recall ${(100*hit/N).toFixed(0).padStart(3)} %  (${hit}/${N})  ${desc}`)}
const fp={};let anyFP=0,totVis=0;for(let s=1;s<=NN;s++){const r=raise(gen(500+s,{}));if(r.vis.length)anyFP++;totVis+=r.vis.length;for(const h of r.vis)fp[h.type]=(fp[h.type]||0)+1}
console.log(`  datos SIN fenómeno (${NN} usuarios): ${anyFP} con algún descubrimiento visible (${(100*anyFP/NN).toFixed(0)} %), ${(totVis/NN).toFixed(2)} visibles por usuario; por tipo:`,JSON.stringify(fp));
check('día de la semana plantado: se descubre y comunica en ≥ 90 % de los casos',res.fri>=.9,res.fri);
check('cambio de nivel plantado: se detecta (como cambio estructural o deriva) en ≥ 70 %',res.shift>=.7,res.shift);
check('deriva lenta plantada: se detecta en ≥ 80 %',res.trend>=.8,res.trend);
check('excepción que se vuelve hábito: se comunica en ≥ 80 %',res.habit>=.8,res.habit);
check('ingreso que se retrasa: se señala en ≥ 85 %',res.income>=.85,res.income);
check('suscripción que deja de cobrarse: se señala en ≥ 85 %',res.sub>=.85,res.sub);
check('sin fenómeno real: ≤ 30 % de los usuarios ven algún descubrimiento (falsos positivos acotados)',anyFP/NN<=.3,anyFP/NN);
check('sin fenómeno real: ningún tipo de descubrimiento supera el 12 % de falsos positivos',Object.values(fp).every(v=>v/NN<=.12),fp);
check('sin fenómeno real: no se inventan patrones de día de la semana, correlaciones ni predicciones de riesgo',!fp['weekday-peak']&&!fp['correlation']&&!fp['liquidity-risk'],fp);
/* anticipación: un riesgo de liquidez planificado se anticipa; sin él no se alarma */
{const mk=(liq,up)=>({today:T,fx:60,position:{liquid:liq,assets:liq,debt:0,net:liq},cardDebtDop:0,loanInstallmentsDop:0,upcoming:up,months:[],ledger:gen(900,{})});
 const risk=D.discover(mk(20000,[{name:'Tarjeta',kind:'card',days:4,amountDop:15000},{name:'Préstamo',kind:'loan',days:9,amountDop:15000}]),{});const calm=D.discover(mk(900000,[{name:'Tarjeta',kind:'card',days:4,amountDop:15000}]),{});
 const flag=r=>[...r.discoveries,...r.internal].some(h=>h.engine==='prediction'&&h.valence==='risk');
 check('anticipación: con compromisos que superan la liquidez se anticipa el riesgo; con liquidez holgada no se alarma',flag(risk)&&!flag(calm),[flag(risk),flag(calm)]);}
console.log(`\nINTELLIGENCE VALIDACIÓN: ${ok} verificaciones aprobadas${bad?`, ${bad} FALLARON`:''}`);process.exit(bad?1:0);
