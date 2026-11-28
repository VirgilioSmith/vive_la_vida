/* VIVE Wrapped · períodos cerrados, estrenos a las 08:00 de Santo Domingo, sin red. */
(function(root){'use strict';const api=(function engine(){
 const kinds=['day','week','month','quarter','year'];
 const titles={day:'Tu día en VIVE',week:'Así viviste tu semana',month:'Tu mes en números',quarter:'Tu trimestre en perspectiva',year:'Un año de decisiones'};
 const iso=d=>d.toISOString().slice(0,10);
 const dt=s=>new Date(s+'T12:00:00Z');
 const shift=(s,n)=>{const d=dt(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
 const boundary=(y,m)=>iso(new Date(Date.UTC(y,m,1,12)));
 const zone=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 function period(kind,asOf,offset=0){
  if(!kinds.includes(kind)||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(dt(asOf).getTime())||iso(dt(asOf))!==asOf||!Number.isSafeInteger(offset)||offset<0||offset>1200)throw Error('Período inválido');
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
 function story(p,a,b){
  const fmt=n=>new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP',currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(n);
  const s=(title,value,detail,theme='calm')=>({title,value,detail,theme});
  if(!a||a.unavailable)return [s('Todavía no hay cifras confiables','Datos pendientes','Falta información de moneda para calcular este período sin distorsiones.')];
  if(!a.count)return [s('Aún no hay una historia registrada','Sin movimientos','Este período no tiene operaciones registradas. No significa que no hayas tenido gastos o ingresos.')];
  const labels={day:['Cada día cuenta','Lo que llegó hoy','Lo que salió hoy','Tu balance del día','El gasto protagonista','Frente al día anterior'],week:['Siete días, una historia','Ingresos de la semana','Egresos de la semana','Tu ritmo financiero','La categoría de la semana','Frente a la semana anterior'],month:['Un mes que dejó huella','Ingresos del mes','Egresos del mes','El balance de tu mes','Tu categoría protagonista','Frente al mes anterior'],quarter:['Perspectiva que transforma','Ingresos del trimestre','Egresos del trimestre','Tu posición de flujo','Tu categoría del trimestre','Frente al trimestre anterior'],year:['Un año de decisiones','Ingresos del año','Egresos del año','Tu balance anual','Tu categoría del año','Frente al año anterior']}[p.kind];
  const hero=s(labels[0],String(a.count),a.count===1?'Movimiento registrado en este período.':'Movimientos registrados en este período.','hero');
  const income=s(labels[1],fmt(a.income),'Ingresos reconocidos en tus registros.','growth');
  const expense=s(labels[2],fmt(a.expense),'Egresos netos, incluidos cargos financieros reconocidos.','warm');
  const balance=s(labels[3],fmt(a.net),'Ingresos menos egresos; no equivale al saldo de tus cuentas.',a.net>=0?'growth':'warm');
  const top=Object.entries(a.byCategory||{}).filter(([,v])=>v>0).sort((x,y)=>y[1]-x[1])[0];
  const category=top?s(labels[4],top[0],fmt(top[1])+' en egresos netos registrados.','hero'):null;
  const comparison=b&&!b.unavailable&&b.count?s(labels[5],fmt(a.net-b.net),a.net>b.net?'Tu balance registrado mejoró.':a.net<b.net?'Tu balance registrado disminuyó.':'Tu balance registrado se mantuvo.','calm'):null;
  const order={day:[hero,income,expense,balance,category,comparison],week:[hero,category,balance,comparison,income,expense],month:[hero,balance,income,expense,category,comparison],quarter:[hero,comparison,balance,category,income,expense],year:[hero,balance,comparison,category,income,expense]}[p.kind];
  return [...order.filter(Boolean),s('Tu siguiente capítulo','vive el hoy',a.net<0?'Revisa las categorías con mayor gasto y organiza tus próximos compromisos.':'Revisa tus prioridades y decide qué quieres mantener para el próximo período.','hero')];
 }
 return {kinds,titles,period,story,schedule};
})();if(typeof module==='object'&&module.exports)module.exports=api;else root.ViveWrappedEngine=api;})(typeof window==='undefined'?globalThis:window);
