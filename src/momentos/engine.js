/* VIVE · Momentos — motor independiente de la interfaz.
   Entrada: un "snapshot" ya calculado por la app (sin red). Salida: cola ordenada de momentos y un reproductor con estado puro.
   Sin DOM, sin temporizadores propios, sin consultas: la UI decide cuándo llamar a tick(). */
(function(root){
 'use strict';
 /* Temas visuales: [acento, fondo claro, fondo oscuro, símbolo vectorial (viewBox 100), glifo] */
 const THEMES={
  calm:['#a5f1d0','#174a3c','#061c17','M50 5 Q58 42 95 50 Q58 58 50 95 Q42 58 5 50 Q42 42 50 5Z','sparkles'],
  amber:['#ffd08a','#89501e','#251408','M25 10 H75 M25 90 H75 M30 10 C30 40 70 60 70 90 M70 10 C70 40 30 60 30 90','calendar'],
  red:['#ffc1b5','#762f31','#260b12','M50 8 L94 85 H6 Z M50 33 V57 M50 70 V71','alert2'],
  growth:['#95efcb','#175d49','#071f20','M10 78 L39 47 L56 62 L88 20 M63 20 H88 V45','trend2'],
  life:['#ffc4ce','#9a455f','#321b43','M50 85 C10 60 4 42 14 23 C24 5 42 10 50 26 C58 10 76 5 86 23 C96 42 90 60 50 85Z','heart2'],
  joseo:['#ffd19d','#80401b','#2c1429','M52 5 C65 35 91 47 78 77 C65 105 20 96 18 70 C16 49 39 30 40 20 C38 46 48 48 52 5Z','briefcase'],
  gratitude:['#ded0ff','#5b4c91','#201b3b','M50 25 A25 25 0 1 0 50 75 A25 25 0 1 0 50 25 M50 2 V14 M50 86 V98 M2 50 H14 M86 50 H98','sparkles'],
  verano:['#ffd9a0','#b4531a','#3f1a0c','M50 85 C10 60 4 42 14 23 C24 5 42 10 50 26 C58 10 76 5 86 23 C96 42 90 60 50 85Z','heart2','./src/momentos/art/verano.jpg','#c7876f'],
  goals:['#a9c8ff','#1d3f86','#0a1636','M8 70 H92 M20 70 C30 40 70 40 80 70 M50 18 V34 M22 30 L32 40 M78 30 L68 40','star']
 };
 const LABELS={finance:'TU REALIDAD FINANCIERA',joseo:'JOSEO',life:'VIVE EL HOY',gratitude:'GRATITUD',goals:'MIS METAS',important:'LO QUE IMPORTA'};
 const MODES=[['all','Para ti'],['finance','Finanzas'],['joseo','Joseo'],['life','Vive el hoy'],['gratitude','Gratitud'],['goals','Mis metas'],['important','Prioriza vida'],['favorites','Favoritos']];
 const mk=(id,mode,title,text,theme,priority,seconds,extra)=>Object.assign({id,mode,title,text,theme,priority,seconds},extra||{});
 /* Biblioteca de frases (local; Joseo es categoría independiente de bienestar). */
 const PHRASES=[
  mk('j1','joseo','Sigue joseando','Que el esfuerzo de hoy financie la libertad de mañana.','joseo',35,10),
  mk('j2','joseo','Poca bulla','Mucho joseo, poca bulla.','joseo',35,10),
  mk('j3','joseo','Construye callado','Construyendo en silencio, viviendo en grande.','joseo',35,10),
  mk('j4','joseo','Dios delante','Dios delante, el joseo detrás.','joseo',35,10),
  mk('j5','joseo','Josea viviendo','Joseando para vivir, no viviendo para josear.','joseo',35,10),
  mk('j6','joseo','Vida soñada','Trabaja por la vida que quieres vivir.','joseo',35,10),
  mk('j7','joseo','Da frutos','El joseo también da sus frutos.','joseo',35,10),
  mk('j8','joseo','Date gustos','Date tus gustos sin hipotecar tu tranquilidad.','joseo',35,10),
  mk('j9','joseo','Tener opciones','No todo es dinero, pero qué bueno es tener opciones.','joseo',35,10),
  mk('l1','life','Vive hoy','La vida también sucede mientras construyes tu futuro.','verano',40,10),
  mk('l2','life','Disfruta proceso','No necesitas tenerlo todo resuelto para disfrutar lo que tienes.','verano',40,10),
  mk('l3','life','Valora presente','Hoy también es parte del plan.','verano',40,10),
  mk('l4','life','Haz recuerdos','Invierte también en experiencias que importan.','verano',40,10),
  mk('l5','life','Respira profundo','Que el ruido del día no te quite la calma.','verano',40,10),
  mk('g1','gratitude','Gracias, Dios','Agradece lo que tienes mientras trabajas por lo que sueñas.','gratitude',30,12),
  mk('g2','gratitude','Agradece siempre','Siempre hay algo por agradecer.','gratitude',30,12),
  mk('g3','gratitude','Valora familia','Celebra el tiempo que compartes con quienes amas.','gratitude',30,12),
  mk('g4','gratitude','Celebra pequeño','Lo sencillo también merece una celebración.','gratitude',30,12),
  mk('i1','important','Prioriza vida','Tu dinero es una herramienta para vivir la vida que valoras.','life',38,10),
  mk('i2','important','Busca equilibrio','Construye mañana sin desaparecer del hoy.','life',38,10),
  mk('i3','important','Tu propósito','Decide qué merece tu energía y cuida lo demás.','life',38,10)
 ];
 const when=n=>n<0?`vencido hace ${-n} día${n===-1?'':'s'}`:n===0?'vence hoy':n===1?'vence mañana':`vence en ${n} días`;
 const names=(l,max)=>{const a=l.slice(0,max||3).map(x=>x.name).filter(Boolean);return a.join(', ')+(l.length>(max||3)?` y ${l.length-(max||3)} más`:'')};
 /* Momentos financieros: solo afirman lo que el snapshot demuestra. */
 function financialMoments(s){
  if(!s||!s.verified)return [mk('unknown','finance','Datos pendientes','No podemos confirmar tu situación financiera con los datos disponibles.','amber',100,15,{hold:true,unverified:true})];
  const out=[];
  const over=(s.overdue||[]).slice().sort((a,b)=>a.days-b.days);
  if(over.length)out.push(mk('overdue','finance','Atención requerida',`${over.length} compromiso${over.length===1?'':'s'} vencido${over.length===1?'':'s'}: ${names(over)}. Revisa tus pagos cuando puedas.`,'red',100,20,{hold:true,critical:true,action:{label:'Ver compromisos',go:over.every(x=>x.go==='wallet')?'wallet':'pressure'}}));
  const up=(s.upcoming||[]).slice().sort((a,b)=>a.days-b.days);
  if(up.length)out.push(mk('payment','finance','Pago pendiente',`${up.length===1?up[0].name+' '+when(up[0].days)+'.':up.length+' compromisos próximos: '+names(up)+'. El primero '+when(up[0].days)+'.'}`,'amber',90,18,{critical:true,action:{label:'Ver compromiso',go:'pressure'}}));
  const cuts=(s.cuts||[]).slice().sort((a,b)=>a.days-b.days);
  if(cuts.length)out.push(mk('cut','finance','Corte cercano',`${cuts.length===1?cuts[0].name+' '+when(cuts[0].days)+'.':cuts.length+' tarjetas con fecha cercana: '+names(cuts)+'. La primera '+when(cuts[0].days)+'.'}`,'amber',80,15,{critical:true,action:{label:'Explorar ciclo',go:'wallet'}}));
  if(s.pressure)out.push(mk('pressure','finance','Gastos elevados',`Este mes tus egresos (${s.pressure.expense}) superan tus ingresos registrados (${s.pressure.income}).`,'amber',70,16,{action:{label:'Ver egresos',go:'expenses'}}));
  if(s.improving)out.push(mk('growth','finance','Vas mejorando',`Tu resultado neto de este mes (${s.improving.net}) supera al del mes anterior (${s.improving.prev}).`,'growth',60,14,{action:{label:'Ver flujo',go:'flow'}}));
  (s.goals||[]).forEach(g=>out.push(mk('goal-'+g.id,'goals',g.title||'Meta cumplida',g.text||'',g.achieved?'growth':'goals',55,14,{action:{label:'Ver mi meta',go:g.go||'overview'}})));
  return out;
 }
 const hash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
 /* Cierre coherente con la realidad: nunca "Todo tranquilo" con alertas críticas o sin datos verificados. */
 function closing(s,fin){
  if(!s||!s.verified)return null;
  if(fin.some(x=>x.critical))return mk('end','finance','Sigue avanzando','Tienes compromisos por atender. Organízalos a tu ritmo.','amber',10,12);
  return mk('end','finance','Todo tranquilo','Estás al día. Disfruta el momento.','calm',10,12);
 }
 /* Cola: prioridad → sin duplicados → frases menos recientes primero (desempate estable por día). */
 function build(snapshot,mode,opts){
  opts=opts||{};const recent=opts.recent||[],fav=opts.favorites||new Set(),seed=String(opts.seed||'');
  const fin=financialMoments(snapshot),end=closing(snapshot,fin);
  const rank=p=>[recent.includes(p.id)?-recent.indexOf(p.id):-1000,hash(seed+p.id)];
  const sorted=PHRASES.slice().sort((a,b)=>{const x=rank(a),y=rank(b);return x[0]-y[0]||x[1]-y[1]});
  /* sorted: primero las nunca reproducidas, luego las más antiguas en el historial. */
  let pool;
  if(mode==='all'){
   const per=['life','joseo','gratitude','important'].map(m=>sorted.find(p=>p.mode===m)).filter(Boolean);
   pool=[...fin.slice().sort((a,b)=>b.priority-a.priority),...per.sort((a,b)=>b.priority-a.priority),end];
  }else if(mode==='finance')pool=[...fin.slice().sort((a,b)=>b.priority-a.priority),end];
  else if(mode==='goals')pool=fin.filter(x=>x.mode==='goals');
  else if(mode==='favorites')pool=[...fin,...PHRASES,end].filter(x=>fav.has(x.id));
  else pool=sorted.filter(p=>p.mode===mode);
  return [...new Map(pool.filter(Boolean).map(x=>[x.id,x])).values()];
 }
 const EMPTY=mk('empty','important','Sin momentos','Todavía no hay contenido para este modo.','calm',0,10,{hold:true});
 /* Reproductor puro: la UI llama tick(segundos) y lee el estado. */
 function createPlayback(){
  const st={queue:[],idx:0,elapsed:0,playing:false};
  const cur=()=>st.queue[st.idx]||EMPTY;
  return {
   state:st,current:cur,
   setQueue(q,keepId){const old=keepId&&cur().id;st.queue=q;const i=old?q.findIndex(x=>x.id===old):-1;st.idx=i>=0?i:0;if(i<0)st.elapsed=0},
   go(i){if(!st.queue.length)return;st.idx=Math.max(0,Math.min(i,st.queue.length-1));st.elapsed=0},
   next(){this.go(st.idx+1)},prev(){this.go(st.idx-1)},
   seek(frac){st.elapsed=Math.max(0,Math.min(1,frac))*cur().seconds},
   play(){if(st.elapsed>=cur().seconds)st.elapsed=0;st.playing=true},pause(){st.playing=false},
   /* Avanza dt segundos; devuelve 'advanced' | 'ended' | 'held' | null. Los momentos "hold" no avanzan solos. */
   tick(dt){
    if(!st.playing)return null;
    st.elapsed+=Math.min(dt,.25);
    const m=cur();
    if(st.elapsed<m.seconds)return null;
    st.elapsed=m.seconds;
    if(m.hold){st.playing=false;return 'held'}
    if(st.idx>=st.queue.length-1){st.playing=false;return 'ended'}
    st.idx++;st.elapsed=0;return 'advanced';
   }
  };
 }
 root.ViveMomentosEngine={THEMES,LABELS,MODES,PHRASES,build,createPlayback,financialMoments,closing,EMPTY};
})(window);
