/* ============================================================================
   VIVE · INTELLIGENCE — motor contextual (sin DOM, sin red, sin temporizadores).
   Observa, relaciona, anticipa, explica y recomienda. NO ejecuta pagos, transferencias ni cambios.

   Entrada : «snapshot» normalizado por el puente de la app (todo en RD$ equivalente, con su origen).
   Salida  : lista priorizada de hallazgos {id, rule, engine, priority, kind, evidence[], period,
             generatedAt, expiresAt, confidence, title, explanation, action, modules[]}.

   Motores (responsabilidades delimitadas)
     context      → calidad y suficiencia de los datos (limitaciones explícitas)
     financial    → flujos: ingresos, gastos, ahorro (periodos completos equivalentes)
     pattern      → patrones de consumo, suscripciones, atípicos
     prediction   → proyecciones (siempre etiquetadas como tales)
     risk         → liquidez, vencimientos, compromisos, exposición
     opportunity  → fondo de reserva, excedentes, intereses evitables
     credit       → utilización y cargas de tarjetas/préstamos
     life         → solo con permiso explícito; sin inferir emociones ni salud
     decision     → relaciona hallazgos y elimina recomendaciones contradictorias
     learning     → pesa relevancia con la retroalimentación (jamás oculta lo esencial)
     narrative    → convierte indicadores en explicaciones humanas
     priority     → clasifica, deduplica, expira y limita saturación
   ========================================================================== */
(function(root){
 'use strict';
 const VERSION='1.0.0';
 const DAY=86400000;
 const num=x=>Number.isFinite(Number(x))?Number(x):0;
 const rnd=x=>Math.round((num(x)+Number.EPSILON)*100)/100;
 const dayMs=d=>Date.parse(d+'T00:00:00Z');
 const addDays=(d,n)=>new Date(dayMs(d)+n*DAY).toISOString().slice(0,10);
 const diffDays=(a,b)=>Math.round((dayMs(a)-dayMs(b))/DAY);
 const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
 const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
 const stdev=a=>{if(a.length<2)return 0;const m=avg(a);return Math.sqrt(avg(a.map(x=>(x-m)**2)))};
 const pct=(a,b)=>b>0?100*a/b:null;
 const fmt=(v,d=0)=>'RD$'+Math.abs(num(v)).toLocaleString('es-DO',{minimumFractionDigits:d,maximumFractionDigits:d});
 const fmtP=(v,d=0)=>num(v).toLocaleString('es-DO',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
 const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 const monthName=ym=>MONTHS[Number(String(ym).slice(5,7))-1]||ym;

 /* ---------- Clases de prioridad (orden de importancia) ---------- */
 const PRIORITY={critical:{rank:0,label:'Crítico'},attention:{rank:1,label:'Requiere atención'},opportunity:{rank:2,label:'Oportunidad'},info:{rank:3,label:'Informativo'},recognition:{rank:4,label:'Reconocimiento'}};
 const KIND={fact:'Observado',projection:'Proyección',interpretation:'Interpretación'};

 /* ==========================================================================
    CONTEXT ENGINE — normaliza y mide la suficiencia de los datos
    ========================================================================== */
 const Context={
  build(snap,prefs){
   const months=(snap.months||[]).map(m=>({...m,income:num(m.income),expense:num(m.expense),interest:num(m.interest),txCount:num(m.txCount),expenseBy:m.expenseBy||{},incomeBy:m.incomeBy||{}}));
   const full=months.filter(m=>!m.partial);
   const withData=full.filter(m=>m.txCount>0);
   const cur=months.find(m=>m.partial)||null;
   const last=withData[withData.length-1]||null,prev=withData[withData.length-2]||null;
   const prior3=withData.slice(-4,-1);
   const t=snap.today;const day=num(snap.dayOfMonth)||Number(t.slice(8,10)),dim=num(snap.daysInMonth)||30;
   const liquid=num(snap.position?.liquid);
   const avgExpense=withData.length?avg(withData.slice(-3).map(m=>m.expense)):0;
   const avgIncome=withData.length?avg(withData.slice(-3).map(m=>m.income)):0;
   const obligations30=(snap.upcoming||[]).filter(u=>u.days>=0&&u.days<=30).reduce((s,u)=>s+num(u.amountDop),0);
   return {snap,prefs:prefs||{},today:t,ym:t.slice(0,7),months,full,withData,cur,last,prev,prior3,day,dim,
    liquid,avgExpense,avgIncome,obligations30,
    q:{months:withData.length,hasAny:num(snap.txCount)>0,hasIncome:avgIncome>0,hasFx:!!num(snap.fx)||!snap.hasUsd,partialMonth:day<dim}};
  }
 };

 /* ==========================================================================
    Fábrica de hallazgos (esquema único)
    ========================================================================== */
 function make(ctx,o){
  const gen=ctx.today,days=o.ttl==null?7:o.ttl;
  return {
   id:o.rule+(o.key?':'+o.key:'')+':'+(o.period||ctx.ym),
   key:o.rule+(o.key?':'+o.key:''),
   rule:o.rule,engine:o.engine,category:o.category||o.engine,
   priority:o.priority,kind:o.kind||'fact',
   evidence:(o.evidence||[]).map(e=>({label:e[0],value:e[1],source:e[2]||'datos registrados'})),
   period:o.period||ctx.ym,generatedAt:gen,expiresAt:addDays(gen,days),
   confidence:Math.max(.1,Math.min(1,o.confidence==null?.8:o.confidence)),
   title:o.title,explanation:o.explanation,
   action:o.action||null,modules:o.modules||['overview'],
   entity:o.entity||null,essential:!!o.essential,urgency:num(o.urgency),magnitude:num(o.magnitude),
   fingerprint:o.fingerprint||String(Math.round(num(o.magnitude)))
  };
 }

 /* ==========================================================================
    REGLAS — cada una: {id, engine, run(ctx) → hallazgo | [hallazgos] | null}
    Se agrupan por motor. Ninguna inventa valores: si falta evidencia, no emiten.
    ========================================================================== */
 const R=[];
 const rule=(id,engine,run)=>R.push({id,engine,run});
 const go=(label,target)=>({label,target});

 /* ----- CONTEXT (4) ----- */
 rule('ctx.empty','context',c=>{
  if(c.q.hasAny)return null;
  return make(c,{rule:'ctx.empty',engine:'context',priority:'info',title:'Aún no hay movimientos para analizar',explanation:'Cuando registres tus primeros ingresos y gastos, VIVE Intelligence empezará a relacionarlos con tus cuentas, tarjetas y compromisos. No se estima nada sin datos.',confidence:1,action:go('Registrar un movimiento','register'),modules:['overview','register'],ttl:14});
 });
 rule('ctx.thin-history','context',c=>{
  if(!c.q.hasAny||c.q.months>=2)return null;
  return make(c,{rule:'ctx.thin-history',engine:'context',priority:'info',title:'Historial corto: las comparaciones son limitadas',explanation:`Hay datos completos de ${c.q.months} mes${c.q.months===1?'':'es'}. Las tendencias y comparaciones se activan con al menos dos meses completos; hasta entonces solo se muestran hechos puntuales.`,evidence:[['Meses completos con movimientos',String(c.q.months)]],confidence:1,modules:['overview'],ttl:14});
 });
 rule('ctx.no-income','context',c=>{
  if(!c.q.hasAny||c.q.hasIncome||!c.q.months)return null;
  return make(c,{rule:'ctx.no-income',engine:'context',priority:'info',title:'No hay ingresos registrados en los últimos meses',explanation:'Sin ingresos registrados no se calculan proporciones sobre ingresos (carga de deuda, ahorro). Registra tu ingreso para activarlas.',confidence:1,action:go('Registrar ingreso','income'),modules:['overview','income'],ttl:14});
 });
 rule('ctx.fx-missing','context',c=>{
  if(!c.snap.hasUsd||num(c.snap.fx)>0)return null;
  return make(c,{rule:'ctx.fx-missing',engine:'context',priority:'attention',title:'Falta la tasa de cambio para consolidar dólares',explanation:'Tienes productos en US$ pero no hay una tasa configurada; los totales en RD$ pueden estar incompletos.',confidence:1,action:go('Configurar tasa','settings'),modules:['overview','banks'],ttl:7,essential:true});
 });

 /* ----- FINANCIAL (16) ----- */
 const lastTwo=c=>c.last&&c.prev&&c.prev.income+c.prev.expense>0;
 rule('fin.income-change','financial',c=>{
  if(!lastTwo(c)||c.prev.income<=0)return null;
  const d=pct(c.last.income-c.prev.income,c.prev.income);if(Math.abs(d)<15)return null;
  const up=d>0;
  return make(c,{rule:'fin.income-change',engine:'financial',priority:up?'recognition':'info',kind:'fact',period:c.last.ym,
   title:up?`Tus ingresos de ${monthName(c.last.ym)} subieron ${fmtP(d)}`:`Tus ingresos de ${monthName(c.last.ym)} bajaron ${fmtP(Math.abs(d))}`,
   explanation:`En ${monthName(c.last.ym)} registraste ${fmt(c.last.income)} frente a ${fmt(c.prev.income)} en ${monthName(c.prev.ym)} (meses completos). ${up?'Conviene decidir qué parte destinar a ahorro o deudas.':'Revisa si fue un ingreso puntual o un cambio sostenido antes de ajustar gastos.'}`,
   evidence:[[`Ingresos ${monthName(c.last.ym)}`,fmt(c.last.income),'movimientos'],[`Ingresos ${monthName(c.prev.ym)}`,fmt(c.prev.income),'movimientos']],
   confidence:.9,action:go('Ver ingresos','income'),modules:['overview','income','register'],magnitude:Math.abs(c.last.income-c.prev.income),fingerprint:c.last.ym});
 });
 rule('fin.expense-change','financial',c=>{
  if(!lastTwo(c)||c.prev.expense<=0)return null;
  const d=pct(c.last.expense-c.prev.expense,c.prev.expense);if(Math.abs(d)<20)return null;
  const up=d>0;
  return make(c,{rule:'fin.expense-change',engine:'financial',priority:up?'info':'recognition',period:c.last.ym,
   title:up?`Tus gastos de ${monthName(c.last.ym)} fueron ${fmtP(d)} mayores`:`Gastaste ${fmtP(Math.abs(d))} menos en ${monthName(c.last.ym)}`,
   explanation:`${fmt(c.last.expense)} en ${monthName(c.last.ym)} frente a ${fmt(c.prev.expense)} en ${monthName(c.prev.ym)}. Los gastos excluyen pagos de tarjeta, transferencias propias y amortización de capital.`,
   evidence:[[`Gastos ${monthName(c.last.ym)}`,fmt(c.last.expense),'movimientos'],[`Gastos ${monthName(c.prev.ym)}`,fmt(c.prev.expense),'movimientos']],
   confidence:.9,action:go('Ver egresos','expenses'),modules:['overview','register'],magnitude:Math.abs(c.last.expense-c.prev.expense),fingerprint:c.last.ym});
 });
 rule('fin.negative-month','financial',c=>{
  if(!c.last||c.last.income<=0||c.last.expense<=c.last.income)return null;
  const gap=c.last.expense-c.last.income;
  return make(c,{rule:'fin.negative-month',engine:'financial',priority:'attention',period:c.last.ym,
   title:`En ${monthName(c.last.ym)} gastaste ${fmt(gap)} más de lo que ingresó`,
   explanation:`Ingresos ${fmt(c.last.income)} y gastos ${fmt(c.last.expense)}. Si fue puntual, tu liquidez absorbe la diferencia; si se repite, conviene revisar las categorías de mayor peso.`,
   evidence:[['Ingresos',fmt(c.last.income),'movimientos'],['Gastos',fmt(c.last.expense),'movimientos']],confidence:.9,action:go('Ver categorías','categories'),modules:['overview','register'],magnitude:gap,fingerprint:c.last.ym,ttl:14});
 });
 rule('fin.saving-streak','financial',c=>{
  const w=c.withData.slice(-3);if(w.length<3||!w.every(m=>m.income>0&&m.income>m.expense))return null;
  return make(c,{rule:'fin.saving-streak',engine:'financial',priority:'recognition',
   title:'Tres meses seguidos con ingresos por encima de los gastos',
   explanation:`En ${w.map(m=>monthName(m.ym)).join(', ')} cerraste con saldo a favor (suma ${fmt(w.reduce((s,m)=>s+m.income-m.expense,0))}).`,
   evidence:w.map(m=>[monthName(m.ym),fmt(m.income-m.expense),'movimientos']),confidence:.9,modules:['overview'],ttl:14,fingerprint:w[2].ym});
 });
 rule('fin.savings-rate','financial',c=>{
  if(!c.last||c.last.income<=0)return null;
  const r=pct(c.last.income-c.last.expense,c.last.income);
  if(r>=20)return make(c,{rule:'fin.savings-rate',engine:'financial',priority:'recognition',period:c.last.ym,title:`Ahorraste ${fmtP(r)} de tus ingresos en ${monthName(c.last.ym)}`,explanation:`Quedaron ${fmt(c.last.income-c.last.expense)} de ${fmt(c.last.income)}. Es un margen sólido; define para qué lo usarás para que no se diluya.`,evidence:[['Ingresos',fmt(c.last.income)],['Gastos',fmt(c.last.expense)]],confidence:.85,modules:['overview'],fingerprint:c.last.ym,ttl:10});
  if(r>=0&&r<5)return make(c,{rule:'fin.savings-rate',engine:'financial',priority:'info',period:c.last.ym,title:`Tu margen de ahorro en ${monthName(c.last.ym)} fue ${fmtP(r,1)}`,explanation:`Quedó poco margen entre ingresos (${fmt(c.last.income)}) y gastos (${fmt(c.last.expense)}). Un pequeño ajuste recurrente tiene más efecto que uno grande y único.`,evidence:[['Ingresos',fmt(c.last.income)],['Gastos',fmt(c.last.expense)]],confidence:.85,action:go('Ver presupuesto','budget'),modules:['overview'],fingerprint:c.last.ym,ttl:10});
  return null;
 });
 rule('fin.category-spike','financial',c=>{
  if(!c.last||c.prior3.length<2)return null;
  let best=null;
  for(const [cat,v] of Object.entries(c.last.expenseBy)){
   if(/impuestos|deudas/i.test(cat))continue;
   const base=avg(c.prior3.map(m=>num(m.expenseBy[cat])));
   if(base>0&&v>=base*1.4&&v-base>=Math.max(1500,.03*c.last.expense)&&(!best||v-base>best.v-best.base))best={cat,v,base};
  }
  if(!best)return null;
  return make(c,{rule:'fin.category-spike',engine:'financial',key:best.cat,priority:'info',kind:'fact',period:c.last.ym,
   title:`${best.cat}: ${fmt(best.v)} en ${monthName(c.last.ym)}, por encima de tu promedio`,
   explanation:`Tu promedio previo en esta categoría es ${fmt(best.base)} al mes (${c.prior3.length} meses completos). Puede deberse a un gasto único; mira el detalle antes de concluir que cambió tu hábito.`,
   evidence:[[`${best.cat} ${monthName(c.last.ym)}`,fmt(best.v),'movimientos'],['Promedio previo',fmt(best.base),'movimientos']],confidence:.8,action:go('Ver categoría','categories'),modules:['overview','register'],magnitude:best.v-best.base,fingerprint:c.last.ym});
 });
 rule('fin.concentration','financial',c=>{
  if(!c.last||c.last.expense<=0)return null;
  const top=Object.entries(c.last.expenseBy).filter(([k])=>!/impuestos|deudas/i.test(k)).sort((a,b)=>b[1]-a[1])[0];
  if(!top)return null;const s=pct(top[1],c.last.expense);if(s<45)return null;
  return make(c,{rule:'fin.concentration',engine:'financial',key:top[0],priority:'info',period:c.last.ym,title:`${top[0]} concentra ${fmtP(s)} de tus gastos`,explanation:`${fmt(top[1])} de ${fmt(c.last.expense)} en ${monthName(c.last.ym)}. Es normal si incluye vivienda o gastos fijos; úsalo como referencia al planificar.`,evidence:[[top[0],fmt(top[1])],['Total gastos',fmt(c.last.expense)]],confidence:.85,modules:['overview','register'],fingerprint:c.last.ym,ttl:10});
 });
 rule('fin.fixed-ratio','financial',c=>{
  const sub=num(c.snap.recurringMonthlyDop);if(sub<=0||c.avgIncome<=0)return null;
  const r=pct(sub,c.avgIncome);if(r<25)return null;
  return make(c,{rule:'fin.fixed-ratio',engine:'financial',priority:'info',title:`Tus pagos recurrentes equivalen a ${fmtP(r)} de tu ingreso`,explanation:`${fmt(sub)} mensuales en suscripciones y servicios frente a un ingreso promedio de ${fmt(c.avgIncome)}. Una proporción alta reduce la flexibilidad cuando cambian los ingresos.`,evidence:[['Recurrentes al mes',fmt(sub),'suscripciones'],['Ingreso promedio',fmt(c.avgIncome),'movimientos']],confidence:.8,action:go('Ver suscripciones','recurring'),modules:['recurring','overview'],magnitude:sub});
 });
 rule('fin.interest-cost','financial',c=>{
  if(!c.last||c.last.interest<=0||c.last.income<=0)return null;
  const r=pct(c.last.interest,c.last.income);if(r<3)return null;
  return make(c,{rule:'fin.interest-cost',engine:'financial',priority:'attention',period:c.last.ym,title:`Pagaste ${fmt(c.last.interest)} en intereses y cargos`,explanation:`Equivale a ${fmtP(r,1)} de tus ingresos de ${monthName(c.last.ym)}. Reducir saldos con mayor tasa es la forma más directa de bajarlo.`,evidence:[['Intereses y cargos',fmt(c.last.interest),'movimientos'],['Ingresos',fmt(c.last.income)]],confidence:.85,action:go('Ver préstamos','loans'),modules:['loans','overview'],magnitude:c.last.interest,fingerprint:c.last.ym});
 });
 rule('fin.fees-taxes','financial',c=>{
  if(!c.last||c.last.expense<=0)return null;const f=num(c.last.expenseBy['Impuestos y comisiones']);
  const r=pct(f,c.last.expense);if(!(f>0)||r<2.5)return null;
  return make(c,{rule:'fin.fees-taxes',engine:'financial',priority:'info',period:c.last.ym,title:`Impuestos y comisiones sumaron ${fmt(f)}`,explanation:`Son ${fmtP(r,1)} de tus gastos de ${monthName(c.last.ym)}. Agrupar transferencias o usar pago presencial cuando convenga puede reducirlos.`,evidence:[['Impuestos y comisiones',fmt(f)],['Gastos',fmt(c.last.expense)]],confidence:.85,modules:['overview','register'],magnitude:f,fingerprint:c.last.ym,ttl:10});
 });
 rule('fin.income-concentration','financial',c=>{
  if(!c.last||c.last.income<=0)return null;
  const top=Object.entries(c.last.incomeBy).sort((a,b)=>b[1]-a[1])[0];if(!top)return null;
  const s=pct(top[1],c.last.income);if(s<90||Object.keys(c.last.incomeBy).length<1)return null;
  return make(c,{rule:'fin.income-concentration',engine:'financial',priority:'info',kind:'interpretation',confidence:.6,period:c.last.ym,title:`${fmtP(s)} de tu ingreso viene de una sola fuente`,explanation:`«${top[0]}» aporta ${fmt(top[1])} de ${fmt(c.last.income)}. Es común con un empleo; si esa fuente cambiara, tu reserva de liquidez es lo que da tiempo.`,evidence:[[top[0],fmt(top[1])]],modules:['income'],ttl:21,fingerprint:c.last.ym});
 });
 rule('fin.income-irregular','financial',c=>{
  const w=c.withData.slice(-4).map(m=>m.income).filter(x=>x>0);if(w.length<3)return null;
  const cv=stdev(w)/avg(w);if(cv<.35)return null;
  return make(c,{rule:'fin.income-irregular',engine:'financial',priority:'info',kind:'interpretation',confidence:.7,title:'Tus ingresos varían bastante de un mes a otro',explanation:`En los últimos ${w.length} meses oscilaron entre ${fmt(Math.min(...w))} y ${fmt(Math.max(...w))}. Con ingresos variables conviene planificar sobre el mes más bajo y mantener una reserva mayor.`,evidence:[['Mínimo',fmt(Math.min(...w))],['Máximo',fmt(Math.max(...w))]],action:go('Ver ingresos','income'),modules:['income','overview'],ttl:21});
 });
 rule('fin.extraordinary-income','financial',c=>{
  if(!c.last||c.prior3.length<2)return null;const b=avg(c.prior3.map(m=>m.income));
  if(!(b>0)||c.last.income<b*1.5||c.last.income-b<5000)return null;
  return make(c,{rule:'fin.extraordinary-income',engine:'financial',priority:'opportunity',kind:'interpretation',confidence:.65,period:c.last.ym,title:`Entró un ingreso superior al habitual en ${monthName(c.last.ym)}`,explanation:`Registraste ${fmt(c.last.income)} frente a un promedio de ${fmt(b)}. Si es extraordinario, repartirlo entre reserva y deudas costosas evita que se absorba en gasto corriente.`,evidence:[['Ingresos',fmt(c.last.income)],['Promedio previo',fmt(b)]],action:go('Ver patrimonio','patrimony'),modules:['overview','income'],magnitude:c.last.income-b,fingerprint:c.last.ym,ttl:14});
 });
 rule('fin.expense-trend','financial',c=>{
  const w=c.withData.slice(-3);if(w.length<3)return null;
  if(!(w[0].expense<w[1].expense&&w[1].expense<w[2].expense&&w[2].expense>=w[0].expense*1.15))return null;
  return make(c,{rule:'fin.expense-trend',engine:'financial',priority:'info',kind:'interpretation',confidence:.7,title:'Tus gastos han subido tres meses seguidos',explanation:`${w.map(m=>`${monthName(m.ym)} ${fmt(m.expense)}`).join(' → ')}. Revisa si el aumento está en gastos fijos o variables.`,evidence:w.map(m=>[monthName(m.ym),fmt(m.expense)]),action:go('Ver categorías','categories'),modules:['overview','register'],fingerprint:w[2].ym,ttl:10});
 });
 rule('fin.month-pace','financial',c=>{
  if(!c.cur||c.q.months<2||c.day<8||!(c.avgExpense>0))return null;
  const proj=c.cur.expense/c.day*c.dim;if(proj<c.avgExpense*1.25||proj-c.avgExpense<3000)return null;
  return make(c,{rule:'fin.month-pace',engine:'prediction',priority:'info',kind:'projection',confidence:Math.min(.75,.35+c.day/c.dim*.5),period:c.ym,
   title:`Al ritmo actual, ${monthName(c.ym)} cerraría con gastos cercanos a ${fmt(proj)}`,
   explanation:`Llevas ${fmt(c.cur.expense)} en ${c.day} días; tu promedio de meses completos es ${fmt(c.avgExpense)}. Es una proyección lineal y los pagos grandes suelen concentrarse, así que puede variar.`,
   evidence:[['Gastos del mes a la fecha',fmt(c.cur.expense),'movimientos'],['Promedio mensual',fmt(c.avgExpense),'movimientos']],action:go('Ver presupuesto','budget'),modules:['overview','register'],magnitude:proj-c.avgExpense,ttl:3,fingerprint:String(Math.round(proj/1000))});
 });
 rule('fin.income-pending','financial',c=>{
  if(!c.cur||c.q.months<2||c.day<20||!(c.avgIncome>0))return null;
  if(c.cur.income>=c.avgIncome*.6)return null;
  return make(c,{rule:'fin.income-pending',engine:'financial',priority:'info',kind:'fact',period:c.ym,title:`Este mes llevas ${fmt(c.cur.income)} de ingresos registrados`,explanation:`Tu promedio mensual es ${fmt(c.avgIncome)}. Si aún esperas cobros, regístralos al recibirlos para que la capacidad de pago refleje la realidad.`,evidence:[['Ingresos del mes',fmt(c.cur.income)],['Promedio',fmt(c.avgIncome)]],action:go('Registrar ingreso','income'),modules:['income','overview'],ttl:3});
 });

 /* ----- RISK (15) ----- */
 rule('risk.overdue','risk',c=>{
  const o=(c.snap.upcoming||[]).filter(u=>u.days<0&&num(u.amountDop)>0);if(!o.length)return null;
  const tot=o.reduce((s,u)=>s+num(u.amountDop),0);
  return make(c,{rule:'risk.overdue',engine:'risk',priority:'critical',essential:true,urgency:100,
   title:`${o.length} pago${o.length===1?'':'s'} vencido${o.length===1?'':'s'} por ${fmt(tot)}`,
   explanation:`${o.slice(0,3).map(u=>`${u.name} (hace ${-u.days} día${-u.days===1?'':'s'})`).join(', ')}${o.length>3?` y ${o.length-3} más`:''}. Ponerte al día primero evita recargos e impacto en tu historial.`,
   evidence:o.slice(0,4).map(u=>[u.name,fmt(u.amountDop),'vencimientos']),confidence:.95,action:go('Ver compromisos','pressure'),modules:['overview','pressure','cards','loans','recurring','banks','accounts','patrimony'],magnitude:tot,ttl:2,fingerprint:o.map(u=>u.id).join(',')});
 });
 rule('risk.due-soon','risk',c=>{
  const o=(c.snap.upcoming||[]).filter(u=>u.days>=0&&u.days<=3&&num(u.amountDop)>0);if(!o.length)return null;
  const tot=o.reduce((s,u)=>s+num(u.amountDop),0);
  return make(c,{rule:'risk.due-soon',engine:'risk',priority:'attention',essential:true,urgency:80,
   title:`Vence${o.length===1?'':'n'} en 3 días: ${fmt(tot)}`,explanation:`${o.slice(0,3).map(u=>`${u.name} (${u.days===0?'hoy':u.days===1?'mañana':'en '+u.days+' días'})`).join(', ')}. Tu liquidez ${c.liquid>=tot?'alcanza para cubrirlo':'no alcanza hoy para cubrirlo'}.`,
   evidence:[...o.slice(0,3).map(u=>[u.name,fmt(u.amountDop),'vencimientos']),['Liquidez disponible',fmt(c.liquid),'cuentas']],confidence:.95,action:go('Ver compromisos','pressure'),modules:['overview','pressure','cards','loans','recurring','banks','accounts'],magnitude:tot,ttl:2,fingerprint:o.map(u=>u.id).join(',')});
 });
 rule('risk.liquidity-vs-30d','risk',c=>{
  if(c.obligations30<=0||c.liquid>=c.obligations30)return null;
  return make(c,{rule:'risk.liquidity-vs-30d',engine:'risk',priority:'critical',essential:true,urgency:90,
   title:'Tu liquidez no cubre los compromisos de 30 días',explanation:`Tienes ${fmt(c.liquid)} disponibles y vencen ${fmt(c.obligations30)} en los próximos 30 días. Faltarían ${fmt(c.obligations30-c.liquid)} salvo que entren ingresos; priorizar por fecha y recargo reduce el riesgo.`,
   evidence:[['Liquidez',fmt(c.liquid),'cuentas'],['Vence en 30 días',fmt(c.obligations30),'vencimientos']],confidence:.85,action:go('Ver compromisos','pressure'),modules:['overview','banks','pressure'],magnitude:c.obligations30-c.liquid,ttl:3});
 });
 rule('risk.cash-crunch','prediction',c=>{
  const list=(c.snap.upcoming||[]).filter(u=>u.days>=0&&u.days<=45&&num(u.amountDop)>0).sort((a,b)=>a.days-b.days);
  if(!list.length||c.liquid<=0)return null;
  let bal=c.liquid,hit=null;for(const u of list){bal-=num(u.amountDop);if(bal<0){hit=u;break}}
  if(!hit||c.liquid<c.obligations30*0)return null;
  if(c.liquid>=c.obligations30)return null; // ya cubierto por la regla anterior
  return make(c,{rule:'risk.cash-crunch',engine:'prediction',priority:'attention',kind:'projection',confidence:.7,title:`Sin nuevos ingresos, tu liquidez se agotaría hacia el ${hit.date.slice(8,10)}/${hit.date.slice(5,7)}`,explanation:`Suma de vencimientos en orden cronológico: al llegar «${hit.name}» el saldo disponible sería negativo. No incluye ingresos aún no registrados.`,evidence:[['Liquidez actual',fmt(c.liquid)],['Primer vencimiento sin cubrir',`${hit.name} · ${hit.date}`]],action:go('Ver compromisos','pressure'),modules:['pressure','overview'],ttl:3,fingerprint:hit.id});
 });
 rule('risk.liquidity-low','risk',c=>{
  if(!(c.avgExpense>0))return null;const m=c.liquid/c.avgExpense;if(m>=1||c.liquid<=0)return null;
  return make(c,{rule:'risk.liquidity-low',engine:'risk',priority:'attention',period:c.ym,title:`Tu liquidez cubre ${m.toFixed(1)} meses de gastos`,explanation:`${fmt(c.liquid)} frente a gastos promedio de ${fmt(c.avgExpense)} al mes. Menos de un mes deja poco margen ante imprevistos.`,evidence:[['Liquidez',fmt(c.liquid),'cuentas'],['Gasto mensual promedio',fmt(c.avgExpense),'movimientos']],confidence:.85,action:go('Ver cuentas','accounts'),modules:['overview','banks','accounts'],ttl:7,fingerprint:String(Math.round(m*10))});
 });
 rule('risk.commitments-high','risk',c=>{
  const d=c.snap.debt;if(!d||d.ratio==null||d.ratio<80)return null;
  return make(c,{rule:'risk.commitments-high',engine:'risk',priority:d.ratio>100?'critical':'attention',essential:true,urgency:70,
   title:d.ratio>100?'Tus compromisos superan lo que tienes disponible este mes':`Tus compromisos usan ${fmtP(d.ratio)} de lo disponible`,
   explanation:`Pendiente este mes ${fmt(d.monthly)} frente a ${fmt(d.available)} (por cobrar + dinero disponible hoy). ${d.ratio>100?'Prioriza por fecha y recargo, y evita nuevos cargos a crédito.':'Margen ajustado: evita asumir nuevos compromisos hasta cerrar el mes.'}`,
   evidence:[['Pendiente del mes',fmt(d.monthly),'capacidad de endeudamiento'],['Disponible',fmt(d.available),'capacidad de endeudamiento']],confidence:.85,action:go('Ver endeudamiento','pressure'),modules:['overview','pressure','loans','cards','patrimony','banks'],magnitude:d.monthly,ttl:3});
 });
 rule('risk.negative-account','risk',c=>{
  const n=(c.snap.accounts||[]).filter(a=>a.balanceDop<-0.005&&a.kind!=='credit');if(!n.length)return null;
  return make(c,{rule:'risk.negative-account',engine:'risk',priority:'attention',essential:true,urgency:60,title:`${n.length===1?'Una cuenta tiene':'Hay cuentas con'} saldo negativo`,explanation:`${n.slice(0,3).map(a=>`${a.name}: ${fmt(a.balanceDop)} en contra`).join(', ')}. Puede ser un movimiento sin registrar o un sobregiro real; concílialo con tu estado de cuenta.`,evidence:n.slice(0,3).map(a=>[a.name,'-'+fmt(a.balanceDop),'saldo calculado']),confidence:.9,action:go('Ver cuentas','accounts'),modules:['banks','accounts','overview'],ttl:3,fingerprint:n.map(a=>a.id).join(',')});
 });
 rule('risk.debt-to-assets','risk',c=>{
  const p=c.snap.position;if(!p||!(p.assets>0))return null;const r=pct(p.debt,p.assets);if(r<60||p.net<0)return null;
  return make(c,{rule:'risk.debt-to-assets',engine:'risk',priority:'info',title:`Tus deudas equivalen a ${fmtP(r)} de tus activos`,explanation:`Activos ${fmt(p.assets)} y deudas ${fmt(p.debt)}. Tu patrimonio sigue siendo positivo, pero un nivel alto reduce tu margen si bajan los activos.`,evidence:[['Activos',fmt(p.assets),'patrimonio'],['Deudas',fmt(p.debt),'patrimonio']],confidence:.85,action:go('Ver patrimonio','patrimony'),modules:['patrimony','overview'],ttl:14});
 });
 rule('risk.net-worth-negative','risk',c=>{
  const p=c.snap.position;if(!p||p.net>=0||!(p.assets>0||p.debt>0))return null;
  return make(c,{rule:'risk.net-worth-negative',engine:'risk',priority:'attention',title:'Tus deudas superan tus activos',explanation:`Patrimonio neto ${'-'+fmt(p.net)}: activos ${fmt(p.assets)} frente a deudas ${fmt(p.debt)}. No es un juicio; es el punto de partida para ordenar qué deuda reducir primero.`,evidence:[['Activos',fmt(p.assets)],['Deudas',fmt(p.debt)]],confidence:.9,action:go('Ver patrimonio','patrimony'),modules:['patrimony','overview','loans'],ttl:14,magnitude:-p.net});
 });
 rule('risk.net-worth-trend','risk',c=>{
  const s=(c.snap.position?.series||[]).filter(x=>Number.isFinite(x.net));if(s.length<3)return null;
  const a=s[s.length-3].net,b=s[s.length-1].net,base=Math.max(1,Math.abs(a));const d=100*(b-a)/base;
  if(d<=-10)return make(c,{rule:'risk.net-worth-trend',engine:'risk',priority:'attention',period:s[s.length-1].ym,title:`Tu patrimonio neto bajó ${fmtP(Math.abs(d))} en dos meses`,explanation:`De ${fmt(a)} a ${fmt(b)}. Mira si vino de nuevas deudas, de gastos o de cambios en activos.`,evidence:[['Hace dos meses',(a<0?'-':'')+fmt(a),'patrimonio'],['Ahora',(b<0?'-':'')+fmt(b),'patrimonio']],confidence:.8,action:go('Ver patrimonio','patrimony'),modules:['patrimony','overview'],ttl:10,fingerprint:s[s.length-1].ym});
  if(d>=8&&b>a)return make(c,{rule:'risk.net-worth-trend',engine:'risk',priority:'recognition',period:s[s.length-1].ym,title:`Tu patrimonio neto creció ${fmtP(d)} en dos meses`,explanation:`De ${fmt(a)} a ${fmt(b)}.`,evidence:[['Hace dos meses',fmt(a),'patrimonio'],['Ahora',fmt(b),'patrimonio']],confidence:.85,action:go('Ver patrimonio','patrimony'),modules:['patrimony','overview'],ttl:10,fingerprint:s[s.length-1].ym});
  return null;
 });
 rule('risk.usd-exposure','risk',c=>{
  const e=c.snap.usd;if(!e||!(e.debtDop>0)||e.debtDop<=e.assetsDop*1.2||e.debtDop<5000)return null;
  return make(c,{rule:'risk.usd-exposure',engine:'risk',priority:'info',kind:'interpretation',confidence:.7,title:'Tienes más deuda en dólares que activos en dólares',explanation:`Deuda en US$ ≈ ${fmt(e.debtDop)} y activos en US$ ≈ ${fmt(e.assetsDop)} (a tasa ${num(c.snap.fx)}). Si el dólar sube, tu deuda en RD$ aumenta sin que cambie tu ingreso.`,evidence:[['Deuda en US$',fmt(e.debtDop)],['Activos en US$',fmt(e.assetsDop)]],action:go('Ver tarjetas','cards'),modules:['cards','overview','banks'],ttl:14});
 });
 rule('risk.account-concentration','risk',c=>{
  const a=(c.snap.accounts||[]).filter(x=>x.balanceDop>0);const tot=a.reduce((s,x)=>s+x.balanceDop,0);if(a.length<2||tot<20000)return null;
  const top=a.sort((x,y)=>y.balanceDop-x.balanceDop)[0];const s=pct(top.balanceDop,tot);if(s<90)return null;
  return make(c,{rule:'risk.account-concentration',engine:'risk',priority:'info',title:`${fmtP(s)} de tu liquidez está en ${top.name}`,explanation:`Tener casi todo en un solo producto simplifica, pero conviene saber dónde está cada parte (por ejemplo, qué es de uso inmediato y qué es reserva).`,evidence:[[top.name,fmt(top.balanceDop)],['Liquidez total',fmt(tot)]],modules:['banks','accounts'],ttl:21});
 });
 rule('risk.unreviewed-pending','risk',c=>{
  const n=num(c.snap.pendingOps);if(n<1)return null;
  return make(c,{rule:'risk.unreviewed-pending',engine:'risk',priority:'info',title:`${n} operación${n===1?'':'es'} pendiente${n===1?'':'s'} de confirmar`,explanation:'Mientras estén pendientes no afectan saldos ni deudas. Confirmarlas mantiene tus cifras al día.',evidence:[['Pendientes',String(n),'registros por confirmar']],confidence:1,action:go('Ver pendientes','register'),modules:['register','overview'],ttl:5,fingerprint:String(n)});
 });

 /* ----- CREDIT (10) ----- */
 const hot=c=>(c.snap.cards||[]).filter(x=>x.limit>0);
 rule('crd.util-high','credit',c=>{
  const h=hot(c).filter(x=>x.util>=70).sort((a,b)=>b.util-a.util);if(!h.length)return null;
  return make(c,{rule:'crd.util-high',engine:'credit',key:h[0].id,priority:h[0].util>=90?'attention':'info',essential:h[0].util>=90,
   title:`${h[0].name} usa ${fmtP(h[0].util)} de su límite`,explanation:`Deuda ${fmt(h[0].debtDop)} sobre un límite de ${fmt(h[0].limitDop)}. Una utilización alta suele pesar en tu historial crediticio; bajarla por debajo de 30 % es lo recomendable.`,
   evidence:[['Deuda',fmt(h[0].debtDop),'tarjetas'],['Límite',fmt(h[0].limitDop),'tarjetas']],confidence:.9,action:go('Ver tarjetas','wallet'),modules:['cards','wallet','overview'],magnitude:h[0].debtDop,fingerprint:String(Math.round(h[0].util/5))});
 });
 rule('crd.util-overall','credit',c=>{
  const t=hot(c);const lim=t.reduce((s,x)=>s+x.limitDop,0),debt=t.reduce((s,x)=>s+x.debtDop,0);if(lim<=0)return null;
  const u=pct(debt,lim);if(u<30||t.some(x=>x.util>=70))return null;
  return make(c,{rule:'crd.util-overall',engine:'credit',priority:'info',title:`Utilizas ${fmtP(u)} de tu crédito total`,explanation:`${fmt(debt)} de ${fmt(lim)} de límite combinado. Por debajo de 30 % es lo más favorable para tu historial.`,evidence:[['Deuda en tarjetas',fmt(debt)],['Límite total',fmt(lim)]],confidence:.85,action:go('Ver tarjetas','wallet'),modules:['cards','wallet'],ttl:10,fingerprint:String(Math.round(u/5))});
 });
 rule('crd.util-good','credit',c=>{
  const t=hot(c);const lim=t.reduce((s,x)=>s+x.limitDop,0),debt=t.reduce((s,x)=>s+x.debtDop,0);if(lim<=0||t.length<1)return null;
  const u=pct(debt,lim);if(u>10)return null;
  return make(c,{rule:'crd.util-good',engine:'credit',priority:'recognition',title:`Usas solo ${fmtP(u,1)} de tu crédito disponible`,explanation:'Mantener la utilización baja es una de las señales más favorables para tu historial crediticio.',evidence:[['Deuda en tarjetas',fmt(debt)],['Límite total',fmt(lim)]],confidence:.85,modules:['cards','wallet'],ttl:14});
 });
 rule('crd.minimum-due','credit',c=>{
  const m=(c.snap.upcoming||[]).filter(u=>u.kind==='card'&&u.days>=0&&u.days<=10);if(!m.length)return null;
  const tot=m.reduce((s,u)=>s+num(u.amountDop),0);if(tot<=0)return null;
  return make(c,{rule:'crd.minimum-due',engine:'credit',priority:'attention',essential:true,urgency:55,title:`Pago de tarjetas en los próximos 10 días: ${fmt(tot)}`,explanation:`${m.slice(0,3).map(u=>`${u.name} · ${u.date.slice(8,10)}/${u.date.slice(5,7)}`).join(', ')}. Pagar el saldo completo evita intereses; el mínimo solo evita mora.`,evidence:m.slice(0,3).map(u=>[u.name,fmt(u.amountDop),'vencimientos']),confidence:.9,action:go('Ver tarjetas','wallet'),modules:['cards','wallet','overview'],magnitude:tot,ttl:3,fingerprint:m.map(u=>u.id).join(',')});
 });
 rule('crd.pay-in-full','opportunity',c=>{
  const debt=num(c.snap.cardDebtDop);if(debt<=0||c.liquid<debt+c.obligations30)return null;
  return make(c,{rule:'crd.pay-in-full',engine:'opportunity',priority:'opportunity',kind:'interpretation',confidence:.75,title:'Podrías saldar tus tarjetas con tu liquidez actual',explanation:`Las tarjetas suman ${fmt(debt)} y tu liquidez (${fmt(c.liquid)}) cubre eso más los vencimientos de 30 días. Pagar el total evita intereses; decide según tu reserva de emergencia.`,evidence:[['Deuda en tarjetas',fmt(debt),'tarjetas'],['Liquidez',fmt(c.liquid),'cuentas'],['Vence en 30 días',fmt(c.obligations30)]],action:go('Ver tarjetas','wallet'),modules:['cards','wallet'],magnitude:debt,ttl:7,fingerprint:String(Math.round(debt/1000))});
 });
 rule('crd.cash-advance','credit',c=>{
  const a=num(c.snap.cashAdvance90);if(a<=0)return null;
  return make(c,{rule:'crd.cash-advance',engine:'credit',priority:'attention',title:'Usaste avances de efectivo en los últimos 90 días',explanation:`Suman ${fmt(a)}. Suelen tener comisión y generar intereses desde el primer día; conviene priorizar su pago.`,evidence:[['Avances 90 días',fmt(a),'tarjetas']],confidence:.9,action:go('Ver tarjetas','wallet'),modules:['cards','wallet'],ttl:10,fingerprint:String(Math.round(a/500))});
 });
 rule('crd.loan-burden','credit',c=>{
  const l=num(c.snap.loanInstallmentsDop);if(l<=0||c.avgIncome<=0)return null;const r=pct(l,c.avgIncome);if(r<35)return null;
  return make(c,{rule:'crd.loan-burden',engine:'credit',priority:'attention',title:`Las cuotas de préstamos equivalen a ${fmtP(r)} de tu ingreso`,explanation:`${fmt(l)} mensuales frente a un ingreso promedio de ${fmt(c.avgIncome)}. Por encima de ~35 % se vuelve difícil absorber imprevistos.`,evidence:[['Cuotas mensuales',fmt(l),'préstamos'],['Ingreso promedio',fmt(c.avgIncome)]],confidence:.85,action:go('Ver préstamos','loans'),modules:['loans','overview'],ttl:10});
 });
 rule('crd.loan-extra','opportunity',c=>{
  const top=(c.snap.loans||[]).filter(l=>l.balanceDop>0&&num(l.rate)>0).sort((a,b)=>b.rate-a.rate)[0];if(!top)return null;
  const reserve=c.avgExpense*3,spare=c.liquid-c.obligations30-reserve;if(!(c.avgExpense>0)||spare<Math.max(5000,top.installmentDop))return null;
  return make(c,{rule:'crd.loan-extra',engine:'opportunity',key:top.id,priority:'opportunity',kind:'interpretation',confidence:.7,title:`Un abono extra a ${top.name} reduciría intereses`,explanation:`Después de reservar 3 meses de gastos y cubrir los vencimientos de 30 días, te quedan unos ${fmt(spare)}. Esta deuda tiene la tasa más alta (${fmtP(top.rate,1)}). Confirma con tu banco el efecto del abono extraordinario.`,evidence:[['Excedente estimado',fmt(spare)],['Tasa',fmtP(top.rate,1),'préstamo']],action:go('Ver préstamos','loans'),modules:['loans','overview'],magnitude:spare,ttl:10,fingerprint:top.id});
 });
 rule('crd.util-improved','credit',c=>{
  const p=num(c.snap.utilPrev);const t=hot(c);const lim=t.reduce((s,x)=>s+x.limitDop,0);if(!(p>0)||lim<=0)return null;
  const u=pct(t.reduce((s,x)=>s+x.debtDop,0),lim);if(p-u<8)return null;
  return make(c,{rule:'crd.util-improved',engine:'credit',priority:'recognition',title:`Bajaste tu utilización de crédito de ${fmtP(p)} a ${fmtP(u)}`,explanation:'Reducir la utilización mejora tu perfil crediticio con el tiempo.',evidence:[['Antes',fmtP(p)],['Ahora',fmtP(u)]],confidence:.75,modules:['cards','wallet'],ttl:14,fingerprint:String(Math.round(u))});
 });
 rule('crd.limit-missing','context',c=>{
  const m=(c.snap.cardsNoLimit||[]);if(!m.length)return null;
  return make(c,{rule:'crd.limit-missing',engine:'context',priority:'info',title:`${m.length===1?'Una tarjeta no tiene':'Hay tarjetas sin'} límite registrado`,explanation:`${m.slice(0,3).join(', ')}. Sin el límite no se calcula su utilización.`,confidence:1,action:go('Editar tarjeta','cards'),modules:['cards','wallet'],ttl:14,fingerprint:m.join(',')});
 });

 /* ----- OPPORTUNITY (6) ----- */
 rule('opp.emergency-gap','opportunity',c=>{
  if(!(c.avgExpense>0)||c.q.months<2)return null;const m=c.liquid/c.avgExpense;if(m>=3||m<1)return null;
  return make(c,{rule:'opp.emergency-gap',engine:'opportunity',priority:'opportunity',kind:'interpretation',confidence:.75,title:`Tu reserva cubre ${m.toFixed(1)} meses; una referencia común es 3 a 6`,explanation:`Tienes ${fmt(c.liquid)} líquidos y gastas ${fmt(c.avgExpense)} al mes. Completar ${fmt(c.avgExpense*3-c.liquid)} más te daría tres meses de respaldo.`,evidence:[['Liquidez',fmt(c.liquid)],['Gasto mensual',fmt(c.avgExpense)]],action:go('Ver cuentas','accounts'),modules:['overview','banks'],magnitude:c.avgExpense*3-c.liquid,ttl:14,fingerprint:String(Math.round(m*10))});
 });
 rule('opp.emergency-ok','opportunity',c=>{
  if(!(c.avgExpense>0)||c.q.months<2)return null;const m=c.liquid/c.avgExpense;if(m<6)return null;
  return make(c,{rule:'opp.emergency-ok',engine:'opportunity',priority:'recognition',title:`Tu reserva cubre ${m.toFixed(1)} meses de gastos`,explanation:'Tienes un colchón sólido ante imprevistos.',evidence:[['Liquidez',fmt(c.liquid)],['Gasto mensual',fmt(c.avgExpense)]],confidence:.85,modules:['overview','banks'],ttl:21});
 });
 rule('opp.idle-cash','opportunity',c=>{
  if(!(c.avgExpense>0)||c.q.months<2)return null;const surplus=c.liquid-c.obligations30-c.avgExpense*9;if(surplus<Math.max(50000,c.avgExpense*2))return null;
  return make(c,{rule:'opp.idle-cash',engine:'opportunity',priority:'opportunity',kind:'interpretation',confidence:.65,title:`Tienes unos ${fmt(surplus)} por encima de 9 meses de reserva`,explanation:'Mantener mucho efectivo sin destino puede restarle rendimiento. Evalúa certificados u otras opciones según tu horizonte; VIVE no ejecuta ninguna acción por ti.',evidence:[['Liquidez',fmt(c.liquid)],['9 meses de gastos',fmt(c.avgExpense*9)]],action:go('Ver patrimonio','patrimony'),modules:['overview','patrimony','banks'],magnitude:surplus,ttl:21,fingerprint:String(Math.round(surplus/10000))});
 });
 rule('opp.certificate-maturity','opportunity',c=>{
  const m=(c.snap.certificates||[]).filter(x=>x.days>=0&&x.days<=30).sort((a,b)=>a.days-b.days)[0];if(!m)return null;
  return make(c,{rule:'opp.certificate-maturity',engine:'opportunity',key:m.id,priority:'opportunity',title:`${m.name} vence ${m.days===0?'hoy':'en '+m.days+' día'+(m.days===1?'':'s')}`,explanation:`Capital ${fmt(m.capitalDop)}. Decide con tiempo si lo renuevas, lo redirige a deudas o lo mantienes líquido.`,evidence:[[m.name,fmt(m.capitalDop),'certificados']],confidence:.9,action:go('Ver certificados','certificates'),modules:['patrimony','banks','overview'],ttl:5,fingerprint:m.id});
 });
 rule('opp.receivable-overdue','opportunity',c=>{
  const o=(c.snap.personal?.overdueReceivable||[]);if(!o.length)return null;const tot=o.reduce((s,x)=>s+x.amountDop,0);
  return make(c,{rule:'opp.receivable-overdue',engine:'opportunity',priority:'attention',title:`Te deben ${fmt(tot)} con fecha de devolución vencida`,explanation:`${o.slice(0,3).map(x=>`${x.person} (${fmt(x.amountDop)})`).join(', ')}. Recordárselo a tiempo suele ser suficiente.`,evidence:o.slice(0,3).map(x=>[x.person,fmt(x.amountDop),'deudas entre personas']),confidence:.9,action:go('Ver entre personas','personal'),modules:['overview','personal'],magnitude:tot,ttl:7,fingerprint:o.map(x=>x.id).join(',')});
 });
 rule('opp.payable-soon','risk',c=>{
  const o=(c.snap.personal?.soonPayable||[]);if(!o.length)return null;const tot=o.reduce((s,x)=>s+x.amountDop,0);
  return make(c,{rule:'opp.payable-soon',engine:'risk',priority:'attention',essential:true,urgency:50,title:`Debes devolver ${fmt(tot)} a personas en los próximos 7 días`,explanation:`${o.slice(0,3).map(x=>`${x.person} (${fmt(x.amountDop)})`).join(', ')}.`,evidence:o.slice(0,3).map(x=>[x.person,fmt(x.amountDop),'deudas entre personas']),confidence:.9,action:go('Ver entre personas','personal'),modules:['overview','personal'],magnitude:tot,ttl:3,fingerprint:o.map(x=>x.id).join(',')});
 });

 /* ----- PATTERN (9) ----- */
 rule('pat.subscriptions-share','pattern',c=>{
  const s=num(c.snap.recurringMonthlyDop),n=(c.snap.recurring||[]).length;if(n<4||s<=0)return null;
  return make(c,{rule:'pat.subscriptions-share',engine:'pattern',priority:'info',title:`${n} suscripciones activas suman ${fmt(s)} al mes`,explanation:`Equivalen a ${fmt(s*12)} al año. Revisar cuáles sigues usando es la forma más simple de recuperar margen.`,evidence:[['Suscripciones activas',String(n),'suscripciones'],['Costo mensual equivalente',fmt(s)]],confidence:.9,action:go('Ver suscripciones','recurring'),modules:['recurring','overview'],ttl:14,fingerprint:String(n)});
 });
 rule('pat.subscription-duplicate','pattern',c=>{
  const seen={};for(const r of c.snap.recurring||[]){const k=String(r.name||'').toLowerCase().replace(/[^a-z0-9áéíóúñ]/g,'').slice(0,12);if(!k)continue;(seen[k]=seen[k]||[]).push(r)}
  const d=Object.values(seen).find(a=>a.length>1);if(!d)return null;
  return make(c,{rule:'pat.subscription-duplicate',engine:'pattern',priority:'info',kind:'interpretation',confidence:.6,title:`Posible suscripción repetida: ${d[0].name}`,explanation:`Hay ${d.length} registros con nombre similar (${d.map(x=>fmt(x.monthlyDop)+'/mes').join(', ')}). Puede ser legítimo (varios planes); verifica que no estés pagando dos veces.`,evidence:d.map(x=>[x.name,fmt(x.monthlyDop),'suscripciones']),action:go('Ver suscripciones','recurring'),modules:['recurring'],ttl:14,fingerprint:d.map(x=>x.id).join(',')});
 });
 rule('pat.subscription-renewal','pattern',c=>{
  const r=(c.snap.recurring||[]).filter(x=>x.days>=0&&x.days<=7&&x.amountDop>0).sort((a,b)=>a.days-b.days);if(!r.length)return null;
  const tot=r.reduce((s,x)=>s+x.amountDop,0);
  return make(c,{rule:'pat.subscription-renewal',engine:'pattern',priority:'info',title:`${r.length} cobro${r.length===1?'':'s'} recurrente${r.length===1?'':'s'} en los próximos 7 días`,explanation:`${r.slice(0,3).map(x=>`${x.name} (${fmt(x.amountDop)})`).join(', ')}${r.length>3?' y más':''}. Total ${fmt(tot)}.`,evidence:r.slice(0,3).map(x=>[x.name,fmt(x.amountDop),'suscripciones']),confidence:.95,action:go('Ver suscripciones','recurring'),modules:['recurring','overview'],ttl:3,fingerprint:r.map(x=>x.id).join(',')});
 });
 rule('pat.outlier-expense','pattern',c=>{
  const tx=(c.snap.recentExpenses||[]);if(tx.length<12)return null;
  const med=median(tx.map(t=>t.amountDop));const big=tx.filter(t=>t.amountDop>=Math.max(med*6,8000)&&diffDays(c.today,t.date)<=14).sort((a,b)=>b.amountDop-a.amountDop)[0];if(!big)return null;
  return make(c,{rule:'pat.outlier-expense',engine:'pattern',key:big.id,priority:'info',kind:'fact',title:`Un gasto de ${fmt(big.amountDop)} destaca frente a tu gasto típico`,explanation:`«${big.label}» el ${big.date.slice(8,10)}/${big.date.slice(5,7)} es muy superior a tu gasto mediano reciente (${fmt(med)}). Solo es una observación estadística; confirma que esté bien clasificado.`,evidence:[[big.label,fmt(big.amountDop),'movimientos'],['Mediana reciente',fmt(med)]],confidence:.75,action:go('Ver movimiento','register'),modules:['register','overview'],ttl:7,fingerprint:big.id});
 });
 rule('pat.recurring-detected','pattern',c=>{
  const g=c.snap.recurringCandidates||[];if(!g.length)return null;const x=g[0];
  return make(c,{rule:'pat.recurring-detected',engine:'pattern',key:x.key,priority:'opportunity',kind:'interpretation',confidence:.65,title:`«${x.label}» se repite cada mes y no está como pago recurrente`,explanation:`Aparece en ${x.months} meses seguidos por ~${fmt(x.amountDop)}. Registrarlo como recurrente mejora tus proyecciones y recordatorios.`,evidence:[[x.label,fmt(x.amountDop),'movimientos'],['Meses consecutivos',String(x.months)]],action:go('Agregar recurrente','recurring'),modules:['recurring','register'],ttl:14,fingerprint:x.key});
 });
 rule('pat.uncategorized','pattern',c=>{
  const n=num(c.snap.uncategorized);if(n<5)return null;
  return make(c,{rule:'pat.uncategorized',engine:'pattern',priority:'info',title:`${n} movimientos sin categoría`,explanation:'Sin categoría no entran en los análisis por tipo de gasto. Clasificarlos mejora la precisión de todos los indicadores.',evidence:[['Sin categoría',String(n),'movimientos']],confidence:1,action:go('Ver movimientos','register'),modules:['register','overview'],ttl:10,fingerprint:String(n)});
 });
 rule('pat.refunds','pattern',c=>{
  const r=num(c.snap.refundsLast30);if(r<=0)return null;
  return make(c,{rule:'pat.refunds',engine:'pattern',priority:'info',title:`Registraste devoluciones por ${fmt(r)} en 30 días`,explanation:'Las devoluciones reducen el gasto o la deuda de la tarjeta correspondiente; no se cuentan como ingreso.',evidence:[['Devoluciones 30 días',fmt(r),'movimientos']],confidence:.95,modules:['register'],ttl:7,fingerprint:String(Math.round(r/100))});
 });
 rule('pat.weekend-share','pattern',c=>{
  const s=c.snap.weekendShare;if(s==null||num(c.snap.recentExpenses?.length)<20)return null;if(s<55)return null;
  return make(c,{rule:'pat.weekend-share',engine:'pattern',priority:'info',kind:'interpretation',confidence:.55,title:`${fmtP(s)} de tus gastos recientes caen en fin de semana`,explanation:'Es un patrón de calendario, no un juicio. Si quieres controlar el gasto variable, planificar el fin de semana puede ser el punto de partida.',evidence:[['Gastos en fin de semana',fmtP(s),'últimos 60 días']],modules:['register'],ttl:14,fingerprint:String(Math.round(s/5))});
 });

 /* ----- PREDICTION (5) ----- */
 rule('prd.end-of-month','prediction',c=>{
  const d=c.snap.debt;if(!d||d.balance==null||c.day>26)return null;
  return make(c,{rule:'prd.end-of-month',engine:'prediction',priority:d.balance<0?'attention':'info',kind:'projection',confidence:.65,title:d.balance<0?`Proyección: al cerrar ${monthName(c.ym)} faltarían ${fmt(-d.balance)}`:`Proyección: te quedarían unos ${fmt(d.balance)} tras pagar lo pendiente`,
   explanation:`Por cobrar este mes más lo disponible hoy (${fmt(d.available)}) menos lo que aún falta por pagar (${fmt(d.monthly)}). No incluye gastos variables futuros.`,evidence:[['Disponible',fmt(d.available),'capacidad de endeudamiento'],['Pendiente',fmt(d.monthly),'capacidad de endeudamiento']],action:go('Ver endeudamiento','pressure'),modules:['overview','pressure'],ttl:3,fingerprint:String(Math.round(d.balance/5000))});
 });
 rule('prd.next-month-load','prediction',c=>{
  const next=num(c.snap.nextMonthObligations);if(next<=0||c.avgIncome<=0)return null;const r=pct(next,c.avgIncome);if(r<50)return null;
  return make(c,{rule:'prd.next-month-load',engine:'prediction',priority:'info',kind:'projection',confidence:.6,title:`El mes próximo ya tiene compromisos por ${fmt(next)}`,explanation:`Equivalen a ${fmtP(r)} de tu ingreso promedio. Conviene tenerlo presente al planificar gastos variables.`,evidence:[['Compromisos del mes próximo',fmt(next),'vencimientos'],['Ingreso promedio',fmt(c.avgIncome)]],action:go('Ver compromisos','pressure'),modules:['overview','pressure'],ttl:7,fingerprint:String(Math.round(next/2000))});
 });
 rule('prd.budget-over','prediction',c=>{
  const b=c.snap.budget;if(!b||!(b.allocated>0))return null;
  if(b.percent>100)return make(c,{rule:'prd.budget-over',engine:'prediction',priority:'attention',kind:'fact',title:`Superaste tu presupuesto de ${monthName(c.ym)} en ${fmt(b.spent-b.allocated)}`,explanation:`Gastado ${fmt(b.spent)} de ${fmt(b.allocated)} asignados (${fmtP(b.percent)}). Los gastos sin presupuesto asignado no entran en este porcentaje.`,evidence:[['Gastado',fmt(b.spent),'presupuesto'],['Asignado',fmt(b.allocated),'presupuesto']],confidence:.9,action:go('Ver presupuesto','budget'),modules:['overview','budget','register'],magnitude:b.spent-b.allocated,ttl:5,fingerprint:String(Math.round(b.percent/10))});
  const expected=c.day/c.dim*100;
  if(b.percent>expected+20&&c.day>=7&&b.percent<=100)return make(c,{rule:'prd.budget-over',engine:'prediction',priority:'info',kind:'projection',confidence:.6,title:`Vas adelantado en tu presupuesto: ${fmtP(b.percent)} usado con ${c.day} de ${c.dim} días`,explanation:`Al ritmo actual podrías llegar al límite antes de fin de mes. Es una proyección lineal.`,evidence:[['Usado',fmtP(b.percent),'presupuesto'],['Mes transcurrido',fmtP(expected)]],action:go('Ver presupuesto','budget'),modules:['overview','budget'],ttl:3,fingerprint:String(Math.round(b.percent/10))});
  return null;
 });
 rule('prd.budget-ok','prediction',c=>{
  const b=c.snap.budget;if(!b||!(b.allocated>0)||c.day<20)return null;if(b.percent>85)return null;
  return make(c,{rule:'prd.budget-ok',engine:'prediction',priority:'recognition',title:`Llevas ${fmtP(b.percent)} de tu presupuesto con el mes casi completo`,explanation:`Gastado ${fmt(b.spent)} de ${fmt(b.allocated)}.`,evidence:[['Gastado',fmt(b.spent)],['Asignado',fmt(b.allocated)]],confidence:.85,modules:['overview','budget'],ttl:5});
 });
 rule('prd.annual-load','prediction',c=>{
  const a=(c.snap.annualCharges||[]);if(!a.length)return null;const x=a[0];
  return make(c,{rule:'prd.annual-load',engine:'prediction',key:x.id,priority:'info',kind:'projection',confidence:.75,title:`${x.name} se renueva en ${x.days} días (${fmt(x.amountDop)})`,explanation:'Los cargos anuales suelen pasar desapercibidos; apartar una fracción cada mes evita que presionen tu liquidez ese día.',evidence:[[x.name,fmt(x.amountDop),'suscripciones']],action:go('Ver suscripciones','recurring'),modules:['recurring','overview'],ttl:7,fingerprint:x.id});
 });

 /* ----- LIFE (2) — solo con permiso explícito; sin inferir emociones ni salud ----- */
 rule('life.leisure-space','life',c=>{
  if(!c.prefs.life||!c.last||c.last.income<=0)return null;
  const l=Object.entries(c.last.expenseBy).filter(([k])=>/entreten|viaje|ocio|salidas/i.test(k)).reduce((s,[,v])=>s+v,0);
  const r=pct(l,c.last.income);if(r==null||r<3)return null;
  return make(c,{rule:'life.leisure-space',engine:'life',priority:'recognition',kind:'interpretation',confidence:.55,period:c.last.ym,title:`Reservaste ${fmtP(r,1)} de tus ingresos para entretenimiento y viajes`,explanation:'Dejar espacio para disfrutar, sin descuidar tus compromisos, es parte de un plan sostenible.',evidence:[['Entretenimiento y viajes',fmt(l)],['Ingresos',fmt(c.last.income)]],modules:['overview'],ttl:14,fingerprint:c.last.ym});
 });
 rule('life.balance-note','life',c=>{
  if(!c.prefs.life||!c.last||c.last.income<=0)return null;
  const sr=pct(c.last.income-c.last.expense,c.last.income);
  const l=Object.entries(c.last.expenseBy).filter(([k])=>/entreten|viaje|ocio|salidas/i.test(k)).reduce((s,[,v])=>s+v,0);
  if(sr==null||sr<30||pct(l,c.last.income)>=1)return null;
  return make(c,{rule:'life.balance-note',engine:'life',priority:'info',kind:'interpretation',confidence:.5,period:c.last.ym,title:'Ahorras mucho y casi no registraste gastos de ocio',explanation:'Si fue una decisión, perfecto. Si te interesa, puedes reservar una cantidad fija mensual para disfrutar. No se infiere nada sobre cómo te sientes: solo cifras registradas.',evidence:[['Tasa de ahorro',fmtP(sr)]],modules:['overview'],ttl:21,fingerprint:c.last.ym});
 });

 /* Total de reglas (verificable) */
 /* Escenarios verificables sobre los datos ya cargados; nunca instrucciones de pago. */
 rule('crd.util-target','credit',c=>{
  if(!c.q.hasFx)return null;
  return hot(c).filter(x=>x.limitDop>0&&x.debtDop>.3*x.limitDop).map(x=>{
   const reduction=x.debtDop-.3*x.limitDop;
   return make(c,{rule:'crd.util-target',key:x.id,entity:{kind:'cards',id:x.productId||x.id},engine:'credit',priority:'opportunity',kind:'projection',confidence:.9,
    title:x.name+' · escenario de utilización al 30 %',
    explanation:'Una reducción hipotética de '+fmt(reduction,2)+' dejaría esta línea en 30 % si no cambian deuda ni límite. Es una referencia de planificación, no una garantía de score ni una instrucción de pago.',
    evidence:[['Deuda registrada',fmt(x.debtDop,2),'tarjetas'],['Límite registrado',fmt(x.limitDop,2),'tarjetas'],['Reducción hipotética',fmt(reduction,2),'cálculo de escenario']],
    modules:['cards','wallet','overview'],magnitude:reduction,ttl:3,action:go('Ver tarjetas','wallet')});
  });
 });
 rule('crd.portfolio-concentration','credit',c=>{
  if(!c.q.hasFx)return null;
  const groups=new Map();
  for(const x of c.snap.cards||[]){const id=x.productId||x.id;if(!id||!(x.debtDop>0))continue;const g=groups.get(id)||{name:x.name,debt:0};g.debt+=x.debtDop;groups.set(id,g)}
  if(groups.size<2)return null;
  const total=[...groups.values()].reduce((s,x)=>s+x.debt,0),top=[...groups.values()].sort((a,b)=>b.debt-a.debt)[0];
  if(!(total>0)||top.debt/total<.75)return null;
  return make(c,{rule:'crd.portfolio-concentration',engine:'credit',priority:'info',kind:'interpretation',confidence:.9,
   title:top.name+' concentra '+fmtP(100*top.debt/total,1)+' de la deuda de tarjetas',
   explanation:'Identifica la exposición principal. La prioridad de pago requiere además tasas, vencimientos y liquidez.',
   evidence:[['Deuda concentrada',fmt(top.debt,2),'tarjetas'],['Deuda total',fmt(total,2),'tarjetas']],modules:['cards','wallet','overview'],ttl:3});
 });
 rule('pat.subscription-annual','prediction',c=>{
  if(!c.q.hasFx)return null;
  const rows=(c.snap.recurring||[]).filter(x=>x.monthlyDop>0),monthly=rows.reduce((s,x)=>s+x.monthlyDop,0);
  if(!(monthly>0))return null;
  const result=[make(c,{rule:'pat.subscription-annual',engine:'prediction',priority:'info',kind:'projection',confidence:.85,
   title:fmt(monthly*12,2)+' de costo recurrente anual equivalente',
   explanation:'Escenario de doce meses si permanecen las tarifas y frecuencias actuales. No equivale a cargos realizados ni presupone renovaciones garantizadas.',
   evidence:[['Equivalente mensual',fmt(monthly,2),'recurrentes'],['Escenario anual',fmt(monthly*12,2),'cálculo de escenario']],modules:['recurring'],ttl:7})];
  if(rows.length>=2){const top=[...rows].sort((a,b)=>b.monthlyDop-a.monthlyDop)[0];result.push(make(c,{rule:'pat.subscription-annual',key:top.id,entity:{kind:'recurring',id:top.id},engine:'opportunity',priority:'opportunity',kind:'projection',confidence:.8,
   title:'Escenario: reducir a la mitad el costo de '+top.name,
   explanation:'Si existe un plan compatible y se mantiene el resto de los compromisos, reducir esta tarifa a la mitad liberaría '+fmt(top.monthlyDop*6,2)+' en doce meses.',
   evidence:[['Costo mensual',fmt(top.monthlyDop,2),'recurrentes'],['Ahorro anual hipotético',fmt(top.monthlyDop*6,2),'cálculo de escenario']],modules:['recurring'],magnitude:top.monthlyDop*6,ttl:7}));}
  return result;
 });
 const RULES=R;

 /* ==========================================================================
    DECISION ENGINE — relaciona hallazgos y elimina contradicciones
    ========================================================================== */
 const Decision={
  reconcile(list){
   const has=id=>list.some(f=>f.rule===id);
   const critLiquidity=list.some(f=>f.priority==='critical'||f.rule==='risk.liquidity-vs-30d'||f.rule==='risk.liquidity-low'||f.rule==='risk.commitments-high');
   const out=[];
   for(const f of list){
    // No sugerir abonos extra, pago total ni excedentes cuando hay presión de liquidez
    if(critLiquidity&&['crd.loan-extra','crd.pay-in-full','opp.idle-cash','fin.extraordinary-income'].includes(f.rule))continue;
    // Si se superó el presupuesto, el reconocimiento por presupuesto no aplica
    if(f.rule==='prd.budget-ok'&&has('prd.budget-over'))continue;
    // Reserva sólida y reserva insuficiente no coexisten
    if(f.rule==='opp.emergency-ok'&&has('risk.liquidity-low'))continue;
    // Reconocimiento de utilización baja no coexiste con utilización alta
    if(f.rule==='crd.util-good'&&(has('crd.util-high')||has('crd.util-overall')))continue;
    // Ahorro alto y mes negativo no coexisten
    if(f.rule==='fin.saving-streak'&&has('fin.negative-month'))continue;
    // Tendencia de patrimonio positiva con patrimonio negativo: se omite el elogio
    if(f.rule==='risk.net-worth-trend'&&f.priority==='recognition'&&has('risk.net-worth-negative'))continue;
    // La proyección de cierre es redundante con vencimientos críticos del mismo tipo
    if(f.rule==='risk.cash-crunch'&&has('risk.liquidity-vs-30d'))continue;
    out.push(f);
   }
   return out;
  }
 };

 /* ==========================================================================
    LEARNING ENGINE — retroalimentación controlada (jamás oculta lo esencial)
    ========================================================================== */
 const Learning={
  emptyState(){return {v:1,fb:{},hidden:{},prefs:{life:false}}},
  normalize(s){const e=Learning.emptyState();if(!s||typeof s!=='object')return e;return {v:1,fb:(s.fb&&typeof s.fb==='object')?s.fb:{},hidden:(s.hidden&&typeof s.hidden==='object')?s.hidden:{},prefs:Object.assign({life:false},s.prefs||{})}},
  /* acción: useful | not_interested | resolved | less */
  record(state,finding,action,today){
   const s=Learning.normalize(state);const r=finding.rule;const f=s.fb[r]=s.fb[r]||{u:0,n:0,l:0,r:0};
   if(action==='useful')f.u++;else if(action==='not_interested')f.n++;else if(action==='less')f.l++;else if(action==='resolved')f.r++;
   if(action==='resolved')s.hidden[finding.key]={fp:finding.fingerprint,until:addDays(today,60),why:'resolved'};
   if(action==='not_interested'&&!finding.essential)s.hidden[finding.key]={fp:null,until:addDays(today,45),why:'not_interested'};
   // «Mostrar menos» sobre un hallazgo esencial solo reduce su frecuencia de repetición, nunca lo elimina
   if(action==='less'&&!finding.essential)s.hidden[finding.key]={fp:null,until:addDays(today,21),why:'less'};
   // acotar tamaño: conserva solo entradas vigentes
   for(const k of Object.keys(s.hidden))if(s.hidden[k].until<today)delete s.hidden[k];
   return s;
  },
  weight(state,rule){const f=(state?.fb||{})[rule];if(!f)return 1;const w=1+Math.min(.3,f.u*.1)-Math.min(.5,f.n*.15+f.l*.1);return Math.max(.4,w)},
  hiddenNow(state,f,today){
   const h=(state?.hidden||{})[f.key];if(!h)return false;
   if(h.until<today)return false;
   if(f.essential&&h.why!=='resolved')return false;        // lo esencial no se silencia con «no me interesa»
   if(h.why==='resolved'&&h.fp&&f.fingerprint&&h.fp!==f.fingerprint)return false; // «ya lo resolví» se reevalúa si cambió la situación
   return true;
  }
 };

 /* ==========================================================================
    PRIORITY ENGINE — clasifica, deduplica, expira y limita saturación
    ========================================================================== */
 const Priority={
  score(f,state){
   const base={critical:1000,attention:700,opportunity:400,info:250,recognition:150}[f.priority]||0;
   const urg=f.urgency||0;const mag=Math.min(60,Math.log10(1+f.magnitude||0)*12);
   return (base+urg+mag)*(f.essential?1:Learning.weight(state,f.rule))*(0.6+0.4*f.confidence);
  },
  /* Reglas de saturación: máx. 1 reconocimiento, máx. 2 informativos por motor, y una ventana total */
  select(list,state,today,opts){
   const o=Object.assign({max:12},opts||{});
   const seen=new Set(),vis=[];
   for(const f of list){
    if(f.expiresAt<today)continue;                      // expiración
    if(seen.has(f.key))continue;seen.add(f.key);        // deduplicación
    if(Learning.hiddenNow(state,f,today))continue;      // descarte/resolución con reevaluación
    f.score=Priority.score(f,state);vis.push(f);
   }
   vis.sort((a,b)=>PRIORITY[a.priority].rank-PRIORITY[b.priority].rank||b.score-a.score);
   const out=[];let rec=0;const perEngineInfo={};
   for(const f of vis){
    if(!o.exhaustive&&f.priority==='recognition'){if(rec>=1)continue;rec++}
    if(!o.exhaustive&&f.priority==='info'){perEngineInfo[f.engine]=(perEngineInfo[f.engine]||0)+1;if(perEngineInfo[f.engine]>2)continue}
    out.push(f);if(!o.exhaustive&&out.length>=o.max)break;
   }
   return out;
  }
 };

 /* ==========================================================================
    NARRATIVE ENGINE — etiquetas humanas y explicación del «por qué»
    ========================================================================== */
 const Narrative={
  kindLabel:k=>KIND[k]||KIND.fact,
  confidenceLabel(c){return c>=.85?'Alta':c>=.65?'Media':'Baja'},
  why(f){
   const ev=f.evidence.length?f.evidence.map(e=>`${e.label}: ${e.value} (${e.source})`).join(' · '):'sin cifras adicionales';
   return `${KIND[f.kind]||'Observado'} · confianza ${Narrative.confidenceLabel(f.confidence).toLowerCase()}. Se muestra porque ${Narrative.reason(f)} Evidencia: ${ev}. Periodo: ${f.period}. Vigente hasta ${f.expiresAt}.`;
  },
  reason(f){
   const m={risk:'afecta tu capacidad de cumplir compromisos.',credit:'afecta tu uso de crédito.',financial:'cambió tu flujo de ingresos y gastos.',pattern:'hay un patrón en tus movimientos.',prediction:'es una estimación a partir de tus datos actuales.',opportunity:'hay margen para mejorar tu situación.',context:'hay datos que limitan los análisis.',life:'activaste esta lectura voluntariamente.'};
   return (m[f.engine]||'coincide con tus datos.');
  }
 };

 /* ==========================================================================
    Orquestador (puro y verificable)
    ========================================================================== */
 function analyze(snapshot,state,opts){
  const st=Learning.normalize(state);
  const ctx=Context.build(snapshot,st.prefs);
  const raw=[];
  const errors=[];
  for(const r of RULES){
   try{const o=r.run(ctx);if(!o)continue;(Array.isArray(o)?o:[o]).forEach(f=>f&&raw.push(f))}catch(e){errors.push({rule:r.id,error:String(e&&e.message||e)})}
  }
  const reconciled=Decision.reconcile(raw);
  const shown=Priority.select(reconciled,st,ctx.today,opts);
  return {findings:shown,all:reconciled,errors,meta:{version:VERSION,rules:RULES.length,evaluated:RULES.length,generated:raw.length,shown:shown.length,today:ctx.today,quality:ctx.q}};
 }

 const api={VERSION,analyze,rules:RULES.map(r=>({id:r.id,engine:r.engine})),PRIORITY,KIND,
  engines:{context:Context,decision:Decision,learning:Learning,priority:Priority,narrative:Narrative},
  _util:{median,stdev,avg,pct,fmt,diffDays,addDays}};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ViveIntelligence=api;
})(typeof window!=='undefined'?window:globalThis);
