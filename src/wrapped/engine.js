/* VIVE Wrapped · períodos cerrados y storytelling determinista, sin red. */
(function(root){'use strict';const api=(function engine(){
 const kinds=['day','week','month','quarter','year'];
 const titles={day:'Tu día en VIVE',week:'Así viviste tu semana',month:'Tu mes en números',quarter:'Tu trimestre en perspectiva',year:'Un año de decisiones'};
 const iso=d=>d.toISOString().slice(0,10);
 const dt=s=>new Date(s+'T12:00:00Z');
 const shift=(s,n)=>{const d=dt(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
 const boundary=(y,m)=>iso(new Date(Date.UTC(y,m,1,12)));
 function period(kind,asOf,offset=0){
  if(!kinds.includes(kind)||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(dt(asOf).getTime())||iso(dt(asOf))!==asOf||!Number.isSafeInteger(offset)||offset<0||offset>1200)throw Error('Período inválido');
  const d=dt(asOf),y=d.getUTCFullYear(),m=d.getUTCMonth();
  let start,end;
  if(kind==='day')start=end=shift(asOf,-1-offset);
  else if(kind==='week'){end=shift(asOf,-((d.getUTCDay()+6)%7)-1-7*offset);start=shift(end,-6)}
  else {const span=kind==='month'?1:kind==='quarter'?3:12;const base=Math.floor(m/span)*span;start=boundary(y,base-span*(offset+1));end=shift(boundary(y,base-span*offset),-1)}
  return {kind,title:titles[kind],start,end,offset};
 }
 function story(p,a,b){
  const fmt=n=>new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP',currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(n);
  const s=(title,value,detail,theme='calm')=>({title,value,detail,theme});
  if(!a||a.unavailable)return [s('Todavía no hay cifras confiables','Datos pendientes','Falta información de moneda para calcular este período sin distorsiones.')];
  if(!a.count)return [s('Aún no hay una historia registrada','Sin movimientos','Este período no tiene operaciones registradas. No significa que no hayas tenido gastos o ingresos.')];
  const slides=[s(p.title,String(a.count),a.count===1?'Movimiento registrado. Así comenzó esta historia.':'Movimientos registrados durante este período.','hero'),s('Lo que llegó',fmt(a.income),'Ingresos reconocidos en tus registros.','growth'),s('Lo que salió',fmt(a.expense),'Egresos netos, incluidos cargos financieros reconocidos.','warm'),s(a.net>=0?'El balance quedó a favor':'El balance quedó en negativo',fmt(a.net),'Ingresos menos egresos. No equivale al saldo de tus cuentas.',a.net>=0?'growth':'warm')];
  const top=Object.entries(a.byCategory||{}).filter(([,v])=>v>0).sort((x,y)=>y[1]-x[1])[0];
  if(top)slides.push(s('Tu categoría protagonista',top[0],fmt(top[1])+' en egresos netos registrados.','hero'));
  if(b&&!b.unavailable&&b.count){const delta=a.net-b.net;slides.push(s('Tu evolución',fmt(delta),delta>0?'Tu balance registrado mejoró frente al período anterior.':delta<0?'Tu balance registrado disminuyó frente al período anterior.':'Tu balance registrado se mantuvo.','calm'))}
  slides.push(s('Tu siguiente capítulo','vive el hoy',a.net<0?'Revisa las categorías con mayor gasto y organiza tus próximos compromisos.':'Revisa tus prioridades y decide qué quieres mantener para el próximo período.','hero'));
  return slides;
 }
 return {kinds,titles,period,story};
})();if(typeof module==='object'&&module.exports)module.exports=api;else root.ViveWrappedEngine=api;})(typeof window==='undefined'?globalThis:window);
