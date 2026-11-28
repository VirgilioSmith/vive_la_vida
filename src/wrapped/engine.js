/* VIVE Wrapped · períodos cerrados, estrenos a las 08:00 de Santo Domingo, sin red. */
(function(root){'use strict';const api=(function engine(){
 const kinds=['day','week','month','quarter','year'];
 const titles={day:'Tu día en VIVE',week:'Así viviste tu semana',month:'Tu mes en números',quarter:'Tu trimestre en perspectiva',year:'Un año de decisiones'};
 const iso=d=>d.toISOString().slice(0,10);
 const dt=s=>new Date(s+'T12:00:00Z');
 const shift=(s,n)=>{const d=dt(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
 const boundary=(y,m)=>iso(new Date(Date.UTC(y,m,1,12)));
 const zone=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(dt(s).getTime())&&iso(dt(s))===s;
 function period(kind,asOf,offset=0){
  if(!kinds.includes(kind)||!validDate(asOf)||!Number.isSafeInteger(offset)||offset<0||offset>1200)throw Error('Período inválido');
  const d=dt(asOf),y=d.getUTCFullYear(),m=d.getUTCMonth();let start,end;
  if(kind==='day')start=end=shift(asOf,-1-offset);
  else if(kind==='week'){end=shift(asOf,-((d.getUTCDay()+6)%7)-1-7*offset);start=shift(end,-6)}
  else {const span=kind==='month'?1:kind==='quarter'?3:12;const base=Math.floor(m/span)*span;start=boundary(y,base-span*(offset+1));end=shift(boundary(y,base-span*offset),-1)}
  return {kind,title:titles[kind],start,end,offset};
 }
 function schedule(now=new Date()){
  const z=Object.fromEntries(zone.formatToParts(now).map(x=>[x.type,x.value]));
  const today=`${z.year}-${z.month}-${z.day}`,released=Number(z.hour)>=8,anchor=released?today:shift(today,-1);
  const items=kinds.map(kind=>{const p=period(kind,anchor),release=shift(p.end,1);let nextDate;
   if(kind==='day')nextDate=shift(release,1);
   else if(kind==='week')nextDate=shift(release,7);
   else {const d=dt(release);nextDate=boundary(d.getUTCFullYear(),d.getUTCMonth()+({month:1,quarter:3,year:12}[kind]));}
   // Santo Domingo uses UTC−04:00 throughout the year.
   const nextAt=new Date(nextDate+'T08:00:00-04:00');
   return {kind,p,release,nextDate,nextAt:nextAt.toISOString(),fresh:release===today&&released};
  });
  return {today,anchor,released,items,fresh:items.filter(x=>x.fresh).reverse(),next:items.slice().sort((a,b)=>a.nextAt.localeCompare(b.nextAt)||kinds.indexOf(b.kind)-kinds.indexOf(a.kind))[0]};
 }
 function containing(kind,anchor,date){
  if(!validDate(date)||!validDate(anchor)||!kinds.includes(kind))return null;
  let low=0,high=1199;
  while(low<=high){
   const mid=(low+high)>>1,p=period(kind,anchor,mid);
   if(date>p.end)high=mid-1;else if(date<p.start)low=mid+1;else return p;
  }
  return null;
 }
 function chapters(p){
  const length=p.kind==='year'?3:p.kind==='quarter'?1:0;
  if(!length)return [];
  const start=dt(p.start),count=p.kind==='year'?4:3;
  return Array.from({length:count},(_,i)=>{
   const month=start.getUTCMonth()+length*i,y=start.getUTCFullYear();
   return {start:boundary(y,month),end:shift(boundary(y,month+length),-1),
    label:(length===3?'Trimestre ':'Mes ')+(i+1)};
  });
 }
 const money=(n,currency='DOP')=>new Intl.NumberFormat('es-DO',{style:'currency',currency,currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(n);
 function specialStory(event){
  return [
   {scene:'cover',theme:'hero',title:'El día que cerraste una deuda',value:event.productName||event.title,detail:'El último abono registrado dejó el capital en cero.',date:event.date},
   {scene:'milestone',theme:'growth',title:'La trayectoria detrás del último abono',value:money(event.principal,event.currency),detail:'Principal original, con abonos de capital registrados en '+event.months+' meses distintos.',date:event.date,data:{events:[event]}},
   {scene:'final',theme:'calm',title:'El siguiente capítulo',value:'Un compromiso menos',detail:'Puedes volver a ese día y comparar tu posición financiera con otro corte.',date:event.date}
  ];
 }
 function story(p,a,b,events=[],series=[],editorial=null){
  const fmt=money;
  const s=(title,value,detail,theme='calm',scene='empty',data=null)=>({title,value,detail,theme,scene,data});
  if(!a||a.unavailable)return [s('Todavía no hay cifras confiables','Datos pendientes','Falta información de moneda para calcular este período sin distorsiones.')];
  if(!a.count&&!events.length)return [s('Aún no hay una historia registrada','Sin movimientos','Este período no tiene operaciones registradas. No significa que no hayas tenido gastos o ingresos.')];
  const labels={day:['Cada día cuenta','Lo que llegó ese día','Lo que salió ese día','Tu balance del día','El gasto protagonista','Frente al día anterior'],week:['Siete días, una historia','Ingresos de la semana','Egresos de la semana','Tu ritmo financiero','La categoría de la semana','Frente a la semana anterior'],month:['Un mes que dejó huella','Ingresos del mes','Egresos del mes','El balance de tu mes','Tu categoría protagonista','Frente al mes anterior'],quarter:['Perspectiva que transforma','Ingresos del trimestre','Egresos del trimestre','Tu posición de flujo','Tu categoría del trimestre','Frente al trimestre anterior'],year:['Un año de decisiones','Ingresos del año','Egresos del año','Tu balance anual','Tu categoría del año','Frente al año anterior']}[p.kind];
  const hero=s(labels[0],String(a.count),a.count===1?'Movimiento registrado en este período.':'Movimientos registrados en este período.','hero','cover',{count:a.count});
  const income=s(labels[1],fmt(a.income),'Ingresos reconocidos en tus registros.','growth','income',{income:a.income,expense:a.expense});
  const expense=s(labels[2],fmt(a.expense),'Egresos netos, incluidos cargos financieros reconocidos.','warm','expense',{income:a.income,expense:a.expense});
  const balance=s(labels[3],fmt(a.net),'Ingresos menos egresos; no equivale al saldo de tus cuentas.',a.net>=0?'growth':'warm','balance',{income:a.income,expense:a.expense});
  const top=Object.entries(a.byCategory||{}).filter(([,v])=>v>0).sort((x,y)=>y[1]-x[1])[0];
  const category=top?s(labels[4],top[0],fmt(top[1])+' en egresos netos registrados.','hero','category',{items:Object.entries(a.byCategory||{}).filter(([,v])=>Number.isFinite(v)&&v>0).sort((x,y)=>y[1]-x[1]).slice(0,3)}):null;
  const comparison=b&&!b.unavailable&&b.count?s(labels[5],fmt(a.net-b.net),a.net>b.net?'Tu balance registrado mejoró.':a.net<b.net?'Tu balance registrado disminuyó.':'Tu balance registrado se mantuvo.','calm','comparison',{previous:b.net,current:a.net}):null;
  const chapter=events.length?s(events[0].kind==='payoff'?'Terminaste de amortizar un préstamo':p.kind==='year'?'Aperturas de tu año':'Un nuevo producto en tu historia',events[0].title,
   events.length===1?(events[0].kind==='payoff'?'El capital llegó a cero tras el abono registrado.':'Apertura con fecha registrada.'):events.length+' acontecimientos con fecha registrada en este período.','growth','milestone',{events:events.slice(0,4)}):null;
  if(chapter)chapter.date=events[0].date;
  if(!a.count)return [chapter];
  const discovery=top&&b?.count&&b.byCategory?.[top[0]]>0&&p.kind!=='day'&&Math.abs(top[1]/b.byCategory[top[0]]-1)>=.25
   ?s(top[1]>b.byCategory[top[0]]?'Subió el gasto de tu categoría principal':'El gasto de tu categoría principal bajó',top[0],
    'Cambio en el importe registrado frente al período anterior. Revisa los movimientos para entender qué cambió.','calm',editorial?'plot':'comparison',
    {previous:b.byCategory[top[0]],current:top[1]}):null;
  const arc=series.length>=3&&series.every(x=>x.count>0&&!x.unavailable)&&series.some(x=>Math.abs(x.net-series[0].net)>=.01)
   ?s(p.kind==='year'?'Tu año en cuatro actos':'Cómo cambió el trimestre',fmt(series.at(-1).net-series[0].net),
    'El cambio corresponde al flujo registrado del primer al último tramo. Cada barra representa ingresos menos egresos.','hero','arc',
    {items:series.map(x=>[x.label,x.net])}):null;
  const scenario=editorial?.scenario;
  const whatIf=scenario?s(scenario.title,fmt(scenario.result),scenario.explanation,'calm','whatif',{previous:scenario.baseline,current:scenario.result}):null;
  const detail=editorial?.detail;
  const director=detail?s(detail.title,'La evidencia',detail.explanation,'calm','director',{evidence:detail.evidence}):null;
  const record=editorial?.record;
  const credits=record?s(record.title,'Un cierre destacado','Récord entre los cierres mensuales comparables consultados por Time Machine.','growth','credits',{events:[record]}):null;
  if(credits)credits.date=record.date;
  const order={day:[hero,income,expense,balance,category,comparison],week:[hero,category,balance,comparison,income,expense],month:[hero,balance,income,expense,category,comparison],quarter:[hero,comparison,balance,category,income,expense],year:[hero,balance,comparison,category,income,expense]}[p.kind];
  if(editorial){
   if(chapter){hero.title=events[0].kind==='payoff'?'El período en que cerraste una deuda':'Un nuevo comienzo en tu historia';hero.theme='growth'}
   else if(discovery){hero.title='El cambio detrás de '+top[0];hero.theme='warm'}
   else if(arc)hero.title=p.kind==='year'?'Tu año, acto por acto':'Tres meses que cuentan una historia';
   else if(comparison&&Math.sign(a.net)!==Math.sign(b.net)&&a.net&&b.net){hero.title='El flujo cambió de signo';hero.theme=a.net>0?'growth':'warm'}
  }
  const ordered=editorial&&(chapter||arc||discovery)
   ?[hero,chapter,arc,discovery,...order.slice(1)]:[...order.slice(0,2),chapter,discovery,arc,...order.slice(2)];
  const chapters=editorial?ordered.filter(x=>x!==income||a.income!==0).filter(x=>x!==expense||a.expense!==0):ordered;
  const next=a.net<0&&top
   ?'Para el próximo período, revisa '+top[0]+'. Fue la categoría con mayor gasto neto en este cierre.'
   :events[0]?.kind==='payoff'
    ?'Compara el corte de la liquidación con otro momento para ver qué cambió en tus compromisos registrados.'
    :comparison&&a.net>b.net
     ?'El flujo subió frente al período anterior. Compara ambos cierres antes de tomar ese cambio como una tendencia.'
     :'El próximo cierre te dará un nuevo punto de comparación.';
  return [...chapters,whatIf,director,s('Tu siguiente capítulo','vive el hoy',next,'hero','final'),credits].filter(Boolean).map(scene=>{
   const estimated=a.estimatedFx||['comparison','plot'].includes(scene.scene)&&b?.estimatedFx;
   return estimated&&['income','expense','balance','category','comparison','plot','arc'].includes(scene.scene)
    ?{...scene,detail:scene.detail+' Parte del equivalente en RD$ se estimó con la tasa configurada.'}:scene;
  });
 }
 return {kinds,titles,period,story,specialStory,schedule,validDate,containing,chapters};
})();if(typeof module==='object'&&module.exports)module.exports=api;else root.ViveWrappedEngine=api;})(typeof window==='undefined'?globalThis:window);
