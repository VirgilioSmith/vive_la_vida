/* VIVE · INTELLIGENCE — presencia en la interfaz (carga bajo demanda).
   · Una franja delgada contextual por módulo (no añade opciones de navegación) y una hoja con todos los hallazgos.
   · Todo el cálculo es local (window.__viveIntel.run con caché invalidada por eventos). Sin polling ni suscripciones. */
(function(){
 'use strict';
 const B=()=>window.__viveIntel;
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 /* página de la app → etiquetas de módulo que la hacen relevante */
 const MAP={overview:['overview'],mobilehub:['overview'],mobilesearch:['overview'],register:['register'],expenses:['register'],categories:['register'],income:['income'],
  banks:['banks','accounts'],accounts:['accounts','banks'],wallet:['cards','wallet'],cards:['cards','wallet'],loans:['loans'],patrimony:['patrimony'],
  certificates:['patrimony'],recurring:['recurring'],payments:['pressure','recurring'],pressure:['pressure'],budget:['budget'],personal:['personal'],benefits:['cards'],kpis:['overview'],advanced:['analytics','income'],analytics:['analytics','income'],annual:['analytics','income'],flow:['analytics','income'],projection:['patrimony'],vision:['patrimony'],score:['score','cards'],transactions:['register']};
 const ICON={critical:'!',attention:'!',opportunity:'↗',info:'i',recognition:'✓'};
 const GROUPS=[['critical','Crítico'],['attention','Requiere atención'],['opportunity','Oportunidades'],['info','Informativo'],['recognition','Reconocimiento']];
 const spark='<svg class="vi-spark" viewBox="0 0 24 24" aria-hidden="true"><path class="vi-spark-a" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><circle class="vi-spark-b" cx="19" cy="17" r="1.6"/><circle class="vi-spark-c" cx="5.5" cy="18" r="1.1"/></svg>';
 let open=null;

 function forModule(res,mods){return res.findings.filter(f=>f.modules.some(m=>mods.includes(m)))}

 const CHEV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
 /* Línea de inteligencia: UN solo componente para todas las vistas. items = hallazgos reales ya ordenados por relevancia; total = cuántos hay disponibles. */
 function strip(items,total,mods){
  const top=items[0];if(!top)return null;
  const el=document.createElement('button');el.type='button';el.className='vi-strip vi-p-'+top.priority;el.dataset.vi='open';el.dataset.viModule=mods[0];
  el.setAttribute('aria-haspopup','dialog');el.__items=items;el.__i=0;
  const extra=Math.max(0,total-1);
  el.innerHTML=`<span class="vi-mark">${spark}</span><span class="vi-copy"><strong></strong></span>${extra>0?`<span class="vi-more" aria-hidden="true">+${extra}</span>`:''}<span class="vi-chev" aria-hidden="true">${CHEV}</span>`;
  el.__extra=extra;show(el,0,false);return el;
 }
 function show(el,i,swap){
  const it=el.__items[i],s=el.querySelector('strong');if(!it||!s)return;
  const apply=()=>{s.textContent=it.title;el.className='vi-strip vi-p-'+it.priority;el.title=it.title;el.setAttribute('aria-label','VIVE Intelligence: '+it.title+(el.__extra>0?'. '+el.__extra+(el.__extra===1?' hallazgo más.':' hallazgos más.'):''));el.__i=i};
  if(!swap){apply();return}
  s.classList.add('is-swap');setTimeout(()=>{if(!el.isConnected)return;apply();s.classList.remove('is-swap')},240);
 }
 /* Rotación suave entre los hallazgos más relevantes: sin reflujo (altura y una sola línea fijas), pausada con la pestaña oculta o la hoja abierta. */
 let rot=null;
 function rotate(el){
  if(rot){clearInterval(rot);rot=null}
  if(!el||el.__items.length<2||window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  rot=setInterval(()=>{if(!el.isConnected){clearInterval(rot);rot=null;return}if(document.hidden||open||el.matches(':active'))return;show(el,(el.__i+1)%el.__items.length,true)},7500);
 }

 /* Dónde va: SIEMPRE justo debajo del título principal de la pantalla.
    PC: bajo el título de la barra superior (.topbar-intro). Móvil: bajo el encabezado propio de la página (h1 + su fila de controles); en Inicio, bajo el saludo.
    El subtítulo descriptivo estático de ese encabezado se retira: la línea de inteligencia ocupa su lugar. Sin lecturas de layout (sin reflow). */
 const hideSubs=root=>{if(!root)return;root.querySelectorAll('p,.top-sub').forEach(p=>{if(!p.querySelector('button,input,select,a,label,summary'))p.classList.add('vi-sub-off')})};
 function place(el){
  const home=document.querySelector('.vive-mobile-home'),page=document.getElementById('page');
  const wide=!window.matchMedia('(max-width:790px)').matches;
  if(wide){const intro=document.querySelector('.topbar .topbar-intro'),t=intro&&intro.querySelector('.top-title');
   if(t){hideSubs(intro);t.after(el);return true}}
  if(home&&!wide){const g=home.querySelector('.vive-mobile-greeting');if(g&&g.nextSibling)home.insertBefore(el,g.nextSibling);else home.prepend(el);return true}
  const main=document.querySelector('#app main.main');
  const h=[...document.querySelectorAll('#page h1,#app main h1')].find(e=>!e.closest('.topbar,[hidden],.modal,#modal-root')&&(!e.checkVisibility||e.checkVisibility({checkVisibilityCSS:true})));
  if(h){let anchor=h;
   for(let n=0;n<4;n++){const p=anchor.parentElement;if(!p||p===page||p===main||p.id==='app'||p.querySelectorAll('*').length>45)break;anchor=p}
   hideSubs(anchor);anchor.after(el);return true}
  el.dataset.viFb='1';   /* sin encabezado todavía (la página lo pinta de forma diferida): mount() lo reintentará */
  if(page&&page.parentElement){page.parentElement.insertBefore(el,page);return true}
  if(main){main.prepend(el);return true}return false
 }
 /* Qué mostrar en la franja según DÓNDE estás. Inicio → lo estratégico (no lo vencido, que ya ven Compromisos y Pagos);
    cada página específica → lo propio de esa página (tarjetas en Wallet, intereses en Préstamos, recurrentes en Suscripciones…).
    Los hallazgos transversales (aparecen en ≥ 5 módulos, como «pagos vencidos») se rebajan fuera de Inicio para que no repitan el mismo mensaje en todas partes. */
 const PRI={critical:3,attention:2,opportunity:1.6,info:1,recognition:1.2};
 const STRATEGIC=new Set(['overview','mobilehub','mobilesearch','kpis']);
 const AFF={wallet:['credit'],cards:['credit'],benefits:['credit'],loans:['credit','financial'],recurring:['pattern'],pressure:['risk','prediction'],payments:['risk','prediction'],patrimony:['financial','prediction'],certificates:['financial'],register:['pattern','financial'],expenses:['pattern','financial'],categories:['pattern','financial'],banks:['financial'],accounts:['financial'],budget:['financial','prediction'],income:['financial','prediction'],personal:['risk']};
 /* Vencimientos vistos desde cada página: tarjetas en Wallet, préstamos en Préstamos, recurrentes en Suscripciones */
 const KIND={wallet:['card'],cards:['card'],benefits:['card'],loans:['loan'],recurring:['recurring'],payments:['recurring','card','loan']};
 const WORD={card:['de tarjeta','de tarjeta'],loan:['de préstamo','de préstamo'],recurring:['recurrente','recurrentes']};
 function scoped(page,d){
  const ks=KIND[page];if(!ks||!d||!d.snapshot)return [];const up=(d.snapshot.upcoming||[]).filter(x=>ks.includes(x.kind)&&x.amountDop>0);const f=v=>'RD$'+Math.round(v).toLocaleString('es-DO');
  const od=up.filter(x=>x.days<0),soon=up.filter(x=>x.days>=0&&x.days<=7).sort((a,b)=>a.days-b.days),out=[];
  const w=ks.length===1?WORD[ks[0]]:['','']; const go=page==='loans'?'loans':page==='recurring'?'recurring':'wallet';
  if(od.length)out.push({id:'sc-od',key:'sc-od',rule:'scoped.overdue',engine:'risk',kind:'fact',priority:'critical',modules:[page],title:`${od.length} pago${od.length===1?'':'s'} ${ks.length===1?w[0]+' ':''}vencido${od.length===1?'':'s'} por ${f(od.reduce((s,x)=>s+x.amountDop,0))}`,confidence:{level:'alta'}});
  else if(soon.length)out.push({id:'sc-soon',key:'sc-soon',rule:'scoped.soon',engine:'risk',kind:'fact',priority:'attention',modules:[page],title:`${soon[0].name} vence ${soon[0].days===0?'hoy':'en '+soon[0].days+' día'+(soon[0].days===1?'':'s')}: ${f(soon[0].amountDop)}`,confidence:{level:'alta'}});
  return out}
 const LENS={personal:'personal',advanced:'analytics',analytics:'analytics',annual:'analytics',flow:'analytics',projection:'patrimony',vision:'patrimony',score:'score',transactions:'register',budget:'budget',wallet:'cards',cards:'cards',benefits:'cards',loans:'loans',recurring:'recurring',payments:'recurring',banks:'banks',accounts:'banks',register:'register',expenses:'register',categories:'register',income:'income',patrimony:'patrimony',certificates:'patrimony'};
 const lensScore=h=>2.3+(h.valence==='risk'?.7:h.valence==='positive'?.3:.1)+(h.urgency||0)*2+(h.confidence?h.confidence.score*.4:0);
 /* De lo macro a lo micro: Inicio (todo Vive) → módulo (su escenario) → producto o persona abierta (su detalle) */
 const lensFor=(page,d)=>{if(STRATEGIC.has(page))return d&&d.digest?[...d.digest]:[];const dom=LENS[page];const list=dom&&d&&d.lens&&d.lens[dom]?d.lens[dom]:[];if(!list.length)return [];
  let ent=null;try{ent=B().entity&&B().entity()}catch(_){}
  const sorted=l=>[...l].sort((a,b)=>lensScore(b)-lensScore(a));
  const micro=ent?list.filter(h=>h.entity&&h.entity.kind===ent.kind&&String(h.entity.id)===String(ent.id)):[];
  return [...sorted(micro).map(h=>({...h,__micro:true})),...sorted(list.filter(h=>!h.entity))]};
 function rankAll(page,list,d,mods){
  const strat=STRATEGIC.has(page);const c=[];
  for(const h of lensFor(page,d)){const fake={...h,priority:h.valence==='risk'?'attention':h.valence==='positive'?'recognition':'info',title:h.title,modules:h.modules};c.push({item:fake,disc:h,s:lensScore(h)+.4+(h.__micro?3:0)})}
  for(const f of scoped(page,d))c.push({item:f,s:(PRI[f.priority]||1)+.5});
  for(const f of list){let s=PRI[f.priority]||1;const broad=f.modules.length>=5;
   if(!strat&&broad&&!['pressure','payments'].includes(page))continue;
   if(strat){if(/^risk\.(overdue|due-soon)$/.test(f.rule||''))s-=2.6;if(f.kind==='projection'||f.kind==='interpretation')s+=1.4;else if(f.kind==='fact')s-=.3;if(f.priority==='recognition')s+=.8}
   else{if(broad)s-=2.3;if((AFF[page]||[]).includes(f.engine))s+=1.2;if(f.modules[0]&&mods.includes(f.modules[0]))s+=.8}
   c.push({item:f,s})}
  if(d)for(const h of d.discoveries){if(h.repeat)continue;const m=h.modules||['overview'];if(!m.some(x=>mods.includes(x)))continue;
   const fake={...h,priority:h.valence==='risk'?'attention':h.valence==='positive'?'recognition':'info',title:h.title,modules:m};
   c.push({item:fake,disc:h,s:(h.valence==='risk'?2.6:2.3)+(strat?1.8:.6)+(m[0]&&mods.includes(m[0])?.6:0)})}
  c.sort((a,b)=>b.s-a.s);return c}

 const rank=(page,list,d,mods)=>rankAll(page,list,d,mods)[0]||null;
 let retry=null;
 function mount(again){
  try{
   if(retry){retry.forEach(clearTimeout);retry=null}
   if(rot){clearInterval(rot);rot=null}
   document.querySelectorAll('.vi-strip').forEach(n=>n.remove());
   document.querySelectorAll('.vi-sub-off').forEach(n=>n.classList.remove('vi-sub-off'));
   const b=B();if(!b)return;const mods=MAP[b.page()];if(!mods)return;
   const res=b.run();const list=forModule(res,mods);
   let d=null;try{d=B().discover()}catch(_){}
   let all=rankAll(b.page(),list,d,mods);
   if(!all.length&&!STRATEGIC.has(b.page()))all=rankAll('overview',forModule(res,['overview']),d,['overview']);   /* sin nada propio, el módulo hereda lo macro (lo más relevante de todo Vive) */
   const seen=new Set(),items=[];
   for(const c of all){const t=c.item.title;if(!t||seen.has(t))continue;seen.add(t);items.push({title:t,priority:c.item.priority||'info'})}
   if(!items.length)return;
   const el=strip(items.slice(0,4),items.length,mods);
   if(el&&place(el)){rotate(el);if(!again)retry=[350,1100].map(ms=>setTimeout(()=>{const s=document.querySelector('.vi-strip');if(!s||s.dataset.viFb)mount(true)},ms))}
  }catch(e){console.warn('[Intelligence] mount',e)}
 }

 function card(f){
  const kind=window.ViveIntelligence.engines.narrative.kindLabel(f.kind),conf=window.ViveIntelligence.engines.narrative.confidenceLabel(f.confidence);
  const ev=f.evidence.length?`<ul class="vi-ev">${f.evidence.map(e=>`<li title="Origen: ${esc(e.source)}"><span>${esc(e.label)}</span><b>${esc(e.value)}</b></li>`).join('')}</ul>`:'';
  return `<article class="vi-card vi-p-${f.priority}" data-vi-id="${esc(f.id)}" data-vi-key="${esc(f.key)}">
   <header><span class="vi-ico" aria-hidden="true">${ICON[f.priority]}</span><div><h4>${esc(f.title)}</h4><div class="vi-tags"><span class="vi-kind vi-k-${f.kind}">${esc(kind)}</span><span class="vi-conf">Confianza ${esc(conf.toLowerCase())}</span></div></div></header>
   <p>${esc(f.explanation)}</p>${ev}
   <div class="vi-why" hidden>${esc(window.ViveIntelligence.engines.narrative.why(f))}</div>
   <footer>${f.action?`<button type="button" class="vi-act" data-vi="go" data-target="${esc(f.action.target)}">${esc(f.action.label)} <span aria-hidden="true">→</span></button>`:'<span></span>'}
    <details class="vi-opts"><summary aria-label="Opciones del hallazgo">Opciones</summary><div role="menu">
     <button type="button" role="menuitem" data-vi="fb" data-a="useful">Me resulta útil</button>
     <button type="button" role="menuitem" data-vi="fb" data-a="not_interested">No me interesa</button>
     <button type="button" role="menuitem" data-vi="fb" data-a="resolved">Ya lo resolví</button>
     <button type="button" role="menuitem" data-vi="fb" data-a="less">Mostrar menos</button>
     <button type="button" role="menuitem" data-vi="why">¿Por qué estoy viendo esto?</button>
    </div></details></footer></article>`;
 }


 const FB=[['correct','Esto es correcto'],['incorrect','Esto no es correcto'],['exception','Fue una excepción'],['intentional','Fue intencional'],['known','Ya lo sabía'],['not_interested','No me interesa'],['follow','Quiero seguir observándolo'],['improve','Quiero mejorar este comportamiento'],['helped','Este descubrimiento me ayudó'],['never','No volver a mostrar este tipo de hallazgo']];
 const VAL={risk:'vi-p-attention',positive:'vi-p-recognition',opportunity:'vi-p-opportunity',neutral:'vi-p-info'};
const plainLabel=l=>String(l).replace(/^z robustos?$/i,'Distancia a lo habitual').replace(/^Aislamiento.*$/i,'Rareza del conjunto').replace(/^Correlación de Spearman$/i,'Fuerza de la relación').replace(/^Valor p.*$/i,'Posibilidad de que sea casualidad').replace(/^Pendiente \(Theil.*$/i,'Cambio por semana').replace(/^Tau de Kendall$/i,'Consistencia de la tendencia');
 const PLAIN={pattern:'Comparamos tu comportamiento con tu propia historia.',anomaly:'Comparamos este movimiento con lo que es normal para ti.',drift:'Buscamos cambios sostenidos frente a tu nivel habitual.',blindspot:'Revisamos lo que las cifras visibles no muestran.',correlation:'Buscamos si dos cosas suelen ocurrir juntas, sin asumir que una cause la otra.',prediction:'Proyectamos con tu historial y consideramos la incertidumbre.',evolution:'Comparamos varios periodos entre sí.',sequence:'Observamos qué suele ocurrir después de ciertos eventos.',shadow:'Contrastamos varias señales a la vez y probamos explicaciones alternativas.'};
 function howHTML(h){
  const x=window.ViveDiscovery.explain(h),w=x.how;
  const parts=Object.entries(w.confidence.parts).map(([k,v])=>`<li><span>${esc(k)}</span><b>${v}</b></li>`).join('');
  return `<details class="vi-how"><summary>${esc(w.title)}</summary><div class="vi-how-body">
   <dl><dt>¿Qué detectamos?</dt><dd>${esc(x.detected)}</dd>
   <dt>¿Qué información usamos?</dt><dd>${esc(w.periods)} · ${esc(w.comparison)}</dd>
   <dt>Evidencia</dt><dd><ul class="vi-ev">${w.evidence.map(e=>`<li><span>${esc(plainLabel(e.label))}</span><b>${esc(e.value)}</b></li>`).join('')}</ul></dd>
   <dt>Metodología</dt><dd>${esc(PLAIN[h.engine]||'Comparamos con tu propia historia.')}</dd>
   <dt>¿Aislado o recurrente?</dt><dd>${esc(w.isolated)} · ${esc(w.recurrence)}</dd>
   <dt>Incertidumbre</dt><dd>${esc(w.uncertainty)} Confianza ${esc(w.confidence.level)}.</dd>
   <dt>¿Por qué importa?</dt><dd>${esc(x.why)}</dd><dt>Si continúa</dt><dd>${esc(x.ifContinues)}</dd>
   ${x.counterfactual?`<dt>Escenario alternativo</dt><dd>${esc(x.counterfactual)}</dd>`:''}
   ${h.science&&h.science.alternatives&&h.science.alternatives.length?`<dt>Puesta a prueba (intentamos refutarla)</dt><dd><ul class="vi-ev">${h.science.alternatives.map(a=>`<li><span>${esc(a.text)}</span><b>${a.tested?esc(a.outcome):'No comprobable: '+esc(a.outcome)}</b></li>`).join('')}</ul><small>Estado: ${esc(h.science.status)}. ${esc(h.science.followUp||'')}</small></dd>`:''}
   <dt>Alternativas</dt><dd><ul class="vi-alt">${x.alternatives.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></dd></dl><small>Esto ordena qué mostrar primero; no es una probabilidad.</small></div></details>`;
 }
 function discCard(h){
  const D=window.ViveDiscovery,q=D.reflect(h);
  return `<article class="vi-card vi-disc ${VAL[h.valence]||'vi-p-info'}" data-vi-dkey="${esc(h.key)}">
   <header><span class="vi-ico" aria-hidden="true">✦</span><div><span class="vi-kicker">${esc(h.kicker||'Mira esto')}</span><h4>${esc(h.title)}</h4><div class="vi-tags"><span class="vi-kind vi-k-${esc(h.kind)}">${esc(window.ViveIntelligence.engines.narrative.kindLabel(h.kind))}</span><span class="vi-conf">Confianza ${esc(h.confidence.level)}</span></div></div></header>
   <p>${esc(h.summary)}</p>${h.question?`<div class="vi-ask"><span>${esc(h.question.text)}</span>${h.question.options.map(o=>`<button type="button" class="vi-chip" data-vi="dfb" data-a="${o[1]}">${esc(o[0])}</button>`).join('')}</div>`:(q?`<p class="vi-q">${esc(q)}</p>`:'')}
   ${howHTML(h)}
   <footer>${h.action?`<button type="button" class="vi-act" data-vi="go" data-target="${esc(h.action.target)}">${esc(h.action.label)} <span aria-hidden="true">→</span></button>`:'<span></span>'}
    <details class="vi-opts"><summary aria-label="Retroalimentación">Opciones</summary><div role="menu">${FB.map(([a,l])=>`<button type="button" role="menuitem" data-vi="dfb" data-a="${a}">${esc(l)}</button>`).join('')}</div></details></footer></article>`;
 }
 const OFF=[['spending','Gastos y consumo'],['liquidity','Liquidez y vencimientos'],['habits','Hábitos y relaciones entre variables']];

 const money=v=>(v<0?'-':'')+'RD$'+Math.round(Math.abs(v)).toLocaleString('es-DO');
 function stratHTML(disc){
  const s=disc.strategy;if(!s)return '';const lm=s.lifeModel,cu=s.curiosity;
  return `<h5>Revisión estratégica</h5>
   <p>${esc(lm.note)}</p><ul class="vi-kl">${lm.items.map(i=>`<li><span>${esc(i.label)}<small> · ${esc(i.basis)}</small></span><b>${money(i.amount)}</b></li>`).join('')}</ul><small>${esc(lm.assumptions.join(' · '))}</small>
   <h5>Qué sabe y qué no sabe Vive</h5><ul class="vi-kl">${cu.known.map(k=>`<li><span>${esc(k)}</span><b>Sabe</b></li>`).join('')}${cu.unknown.slice(0,5).map(k=>`<li><span>${esc(k)}</span><b>Aún no</b></li>`).join('')}</ul>
   <h5>Futuros alternativos y decisiones (bajo demanda)</h5><div class="vi-chips"><button type="button" class="vi-chip" data-vi="sfut">Cinco futuros posibles</button><button type="button" class="vi-chip" data-vi="slab">Laboratorio de decisiones</button><button type="button" class="vi-chip" data-vi="schain">¿Y si tomo una cuota de RD$8,000/mes?</button></div><div class="vi-strat" aria-live="polite"></div>`;
 }
 function knowHTML(disc){
  const D=window.ViveDiscovery,m=B().memory(),L=D.Memory.list(m),prof=disc.features.profile,au=disc.audit;
  const li=(a,fn)=>a.length?`<ul class="vi-kl">${a.map(fn).join('')}</ul>`:'<p class="vi-empty-s">Nada por ahora.</p>';
  const del=k=>`<button type="button" class="vi-del" data-vi="dforget" data-key="${esc(k)}" aria-label="Eliminar este conocimiento">Eliminar</button>`;
  const sim=(l,sc)=>`<button type="button" class="vi-chip" data-vi="dsim" data-sc='${esc(JSON.stringify(sc))}'>${esc(l)}</button>`;
  const fbCount=m.fb.length;
  return `<details class="vi-know"><summary>Lo que Vive sabe de ti</summary><div class="vi-know-body">
   <h5>Madurez del aprendizaje</h5><p><b>${esc(prof.maturity)}</b> — ${esc(prof.maturityBasis)}</p>
   <h5>Fuentes autorizadas</h5><ul class="vi-kl"><li><span>Finanzas (movimientos, cuentas, tarjetas, préstamos, suscripciones)</span><b>Activa · solo en tu dispositivo</b></li><li><span>Frases</span><b>Sin relación con tus datos financieros</b></li><li><span>Servicios externos de IA</span><b>No se usan</b></li></ul>
   <h5>Patrones confirmados</h5>${li(L.patterns,x=>`<li><span>${esc(x.title)}</span>${del(x.key)}</li>`)}
   <h5>Hipótesis en observación (aún no se comunican)</h5>${li([...disc.internal.filter(h=>!['discarded','resolved'].includes(h.state)).map(h=>({key:h.key,title:h.title,n:h.seenDays,need:h.minSeen||2})),...L.hypotheses.filter(h=>!disc.internal.some(i=>i.key===h.key)).map(h=>({key:h.key,title:h.title,n:(h.seen||[]).length,need:2}))].slice(0,6),x=>`<li><span>${esc(x.title)}<small> · ${x.n}/${x.need} evaluaciones</small></span>${del(x.key)}</li>`)}
   <h5>En seguimiento y metas</h5>${li([...L.following,...L.goals],x=>`<li><span>${esc(x.title)}</span>${del(x.key)}</li>`)}
   <h5>Excepciones y decisiones conocidas</h5>${li(L.exceptions,x=>`<li><span>${esc(x.title||x.key)}<small> · ${esc(({exception:'excepción',intentional:'intencional',known:'ya lo sabías',incorrect:'no era correcto',not_interested:'sin interés'})[x.why]||x.why)}</small></span>${del(x.key)}</li>`)}
   <h5>Aprendizaje por categoría</h5><div class="vi-toggles">${OFF.map(([k,l])=>`<label class="vi-life"><input type="checkbox" data-vi="doff" data-k="${k}" ${(m.prefs.off&&m.prefs.off[k])?'':'checked'}><span><strong>${l}</strong><small>${(m.prefs.off&&m.prefs.off[k])?'Desactivado':'Activo'}</small></span></label>`).join('')}</div>
   <h5>¿Qué pasaría si…? (simulación bajo demanda)</h5><div class="vi-chips">${sim('Gasto +10 %',{expensePct:10})}${sim('Ingresos −20 %',{incomePct:-20})}${sim('Eliminar RD$5,000/mes de gasto',{removeMonthly:5000})}${sim('Mantener el ritmo actual',{})}</div><div class="vi-sim" aria-live="polite"></div>
   ${stratHTML(disc)}
   <h5>Retroalimentación recibida</h5><p>${fbCount?`${fbCount} respuestas recientes; ajustan el peso de cada motor (${Object.entries(m.w).map(([k,v])=>k+' ×'+v).join(', ')||'sin cambios'}).`:'Aún no has dado retroalimentación.'}</p>
   <div class="vi-know-actions"><button type="button" class="vi-chip" data-vi="dexport">Exportar mi conocimiento</button><button type="button" class="vi-chip vi-danger" data-vi="dforgetall">Borrar todo lo aprendido</button></div></div></details>`;
 }
 function sheetHTML(res,mods){
  const all=res.findings;const mine=mods?forModule(res,mods):[];const ordered=mine.length?[...mine,...all.filter(f=>!mine.includes(f))]:[...all];
  let disc=null;try{disc=B().discover()}catch(e){console.warn('[Intelligence] discover',e)}
  try{const pk=mods?rank(B().page(),mine,disc,mods):null;if(pk&&!pk.disc){const i=ordered.indexOf(pk.item);if(i>0){ordered.splice(i,1);ordered.unshift(pk.item)}}}catch(_){}
  const by=p=>ordered.filter(f=>f.priority===p);
  const lensList=lensFor(B().page(),disc);const gl=(disc?disc.discoveries:[]).filter(h=>!lensList.some(l=>l.key===h.key));const dlist=STRATEGIC.has(B().page())?[...gl,...lensList]:[...lensList,...gl];
  const dsec=dlist.length?`<section class="vi-group"><h3>Descubrimientos<span>${dlist.length}</span></h3>${dlist.map(discCard).join('')}</section>`:'';
  const body=GROUPS.map(([p,l])=>{const a=by(p);const g=a.length?`<section class="vi-group"><h3>${l}<span>${a.length}</span></h3>${a.map(card).join('')}</section>`:'';return (p==='attention'&&(!lensList.length||STRATEGIC.has(B().page()))?g+dsec:g)}).join('').replace(/^$/,'')||(dsec||'<p class="vi-empty">Por ahora no hay nada que destacar. VIVE Intelligence sigue aprendiendo en silencio y vuelve a evaluar cuando registres o cambies información.</p>');
  const bodyFinal=((lensList.length&&!STRATEGIC.has(B().page()))||!/Descubrimientos<span>/.test(body))&&dsec?dsec+body:body;   /* en Inicio lo urgente va primero; en cada módulo, lo propio del módulo */
  const q=res.meta.quality||{};
  const life=B().prefs().life;
  return `<div class="vi-layer" data-vi="backdrop"><section class="vi-sheet" role="dialog" aria-modal="true" aria-labelledby="vi-title">
   <header class="vi-head"><button type="button" class="vi-back" data-vi="close" aria-label="Volver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m6-6-6 6 6 6"/></svg></button><div><h2 id="vi-title">${spark}VIVE Intelligence</h2><p>Observa, relaciona, anticipa y recomienda. No ejecuta pagos ni cambios.</p></div></header>
   <div class="vi-body">${bodyFinal}</div>
  </section></div>`;
 }

 function openSheet(mods){
  closeSheet();const b=B();if(!b)return;const res=b.run();
  const wrap=document.createElement('div');wrap.innerHTML=sheetHTML(res,mods);open=wrap.firstElementChild;document.body.appendChild(open);
  document.documentElement.classList.add('vi-open');
  requestAnimationFrame(()=>{open&&open.classList.add('is-in');open&&open.querySelector('.vi-back')?.focus()});
 }
 function closeSheet(){if(open){open.remove();open=null}document.documentElement.classList.remove('vi-open')}
 function refresh(mods){const sc=open&&open.querySelector('.vi-body');const y=sc?sc.scrollTop:0;const m=open&&open.dataset.mods?open.dataset.mods.split(','):mods;openSheet(m);const n=open&&open.querySelector('.vi-body');if(n)n.scrollTop=y}

 document.addEventListener('click',e=>{
  const t=e.target.closest?.('[data-vi]');if(!t)return;
  const k=t.dataset.vi;
  if(k==='open'){e.preventDefault();openSheet((MAP[B().page()]||null));return}
  if(!open)return;
  if(k==='backdrop'){if(e.target===t)closeSheet();return}
  if(k==='close'){closeSheet();return}
  if(k==='go'){const id=t.dataset.target;closeSheet();B().go(id);return}
  if(k==='why'){const c=t.closest('.vi-card');const w=c.querySelector('.vi-why');w.hidden=!w.hidden;t.closest('details')?.removeAttribute('open');return}
  if(k==='dfb'){const c=t.closest('.vi-card');const d=B().discover();const h=[...d.discoveries,...d.internal,...Object.values(d.lens||{}).flat()].find(x=>x.key===c.dataset.viDkey);
   if(h){B().discFeedback(h,t.dataset.a);B().toast(({correct:'Patrón confirmado y recordado.',incorrect:'Anotado: lo descartamos y ajustamos.',exception:'Excepción anotada: no altera tu línea base.',intentional:'Decisión intencional registrada.',known:'Entendido: lo silenciamos por un tiempo.',not_interested:'Listo: no lo mostraremos por un tiempo.',follow:'Lo seguiremos observando.',improve:'Meta de mejora creada.',helped:'Gracias: priorizaremos este tipo de hallazgo.',never:'No volverás a ver este tipo de hallazgo.'})[t.dataset.a]);}
   const mods=MAP[B().page()]||null;openSheet(mods);mount();return}
  if(k==='dforget'){B().memOp('forget',t.dataset.key);openSheet(MAP[B().page()]||null);mount();return}
  if(k==='dforgetall'){if(window.confirm('¿Borrar todo lo que VIVE Intelligence ha aprendido? Tus movimientos no se tocan.')){B().memOp('forgetAll');B().toast('Conocimiento eliminado.');openSheet(MAP[B().page()]||null);mount()}return}
  if(k==='dexport'){const blob=new Blob([B().memOp('export')],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vive-conocimiento-personal.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);return}
  if(k==='sfut'||k==='slab'||k==='schain'){const box=open.querySelector('.vi-strat');const A=B().strategic();let h='';
   if(k==='sfut'){const r=A.horizon();h=!r.ok?`<p><small>${esc(r.reason)}</small></p>`:`${Object.values(r.futures).map(f=>`<div class="vi-fut"><b>${esc(f.label)}</b><small>${esc(f.assumptions)}</small><div class="vi-fut-g">${[30,90,365].map(x=>{const v=f.horizons[x];return `<span><i>${x} d</i><b>${money(v.p50)}</b><small>${money(v.p10)} – ${money(v.p90)}</small></span>`}).join('')}</div></div>`).join('')}<p><small>Disponibilidad = liquidez − deuda de tarjetas. Central y rango (p10–p90). ${esc(r.note)} ${esc(r.limits||'')}</small></p>`}
   else if(k==='slab'){const r=A.decisionLab();h=!r.ok?`<p><small>${esc(r.reason)}</small></p>`:r.alternatives.map(a=>`<details class="vi-how"><summary>${esc(a.label)}</summary><div class="vi-how-body"><p>${esc(a.description)}</p><dl><dt>Beneficios</dt><dd>${esc(a.benefits.join(' · '))}</dd><dt>Costos</dt><dd>${esc(a.costs.join(' · '))}</dd><dt>Incertidumbre</dt><dd>${esc(a.uncertainties.join(' · '))}</dd><dt>Reversibilidad / flexibilidad</dt><dd>${esc(a.reversibility)} / ${esc(a.flexibility)}</dd><dt>A 365 días</dt><dd>central ${money(a.futureImpact.p50_365)} · trayectorias negativas ${Math.round(a.futureImpact.pNeg_365*100)} %</dd></dl></div></details>`).join('')+`<p><small>${esc(r.note)}</small></p>`}
   else{const r=A.chain({label:'Nueva cuota',monthly:8000,down:0});h=['first','second','third','fourth'].map(o=>`<p><b>${esc(r[o].title)}</b><br>${esc(r[o].text)}</p>`).join('')+`<p><small>${esc(r.positives)} Supuestos: ${esc(r.assumptions.join(' · '))}.</small></p>`}
   box.innerHTML=h;return}
  if(k==='sans'){if(t.dataset.multi==='1'){t.classList.toggle('vi-on');return}B().answer(t.dataset.id,t.dataset.v);B().toast('Gracias: lo tendré en cuenta.');openSheet(MAP[B().page()]||null);return}
  if(k==='sdone'){const v=[...open.querySelectorAll('[data-vi="sans"].vi-on')].map(x=>x.dataset.v);if(v.length){B().answer(t.dataset.id,v);B().toast('Gracias: lo tendré en cuenta.');openSheet(MAP[B().page()]||null)}return}
  if(k==='dsim'){const sc=JSON.parse(t.dataset.sc||'{}');const r=B().simulate(sc);const box=open.querySelector('.vi-sim');const f=v=>'RD$'+Math.round(Math.abs(v)).toLocaleString('es-DO');
   box.innerHTML=r.ok?`<div class="vi-sim-grid"><div><small>Conservador</small><b>${(r.conservative<0?'-':'')+f(r.conservative)}</b></div><div><small>Central</small><b>${(r.central<0?'-':'')+f(r.central)}</b></div><div><small>Favorable</small><b>${(r.favorable<0?'-':'')+f(r.favorable)}</b></div></div><p><small>Liquidez estimada en ${r.months} meses. Probabilidad de quedar en negativo: ${Math.round(r.pNegative*100)} %. ${esc(r.assumptions.join(' · '))}. ${esc(r.note)}</small></p>`:`<p><small>${esc(r.reason)}</small></p>`;return}
  if(k==='fb'){
   const c=t.closest('.vi-card');const res=B().run();const f=res.all.find(x=>x.id===c.dataset.viId)||res.findings.find(x=>x.id===c.dataset.viId);
   if(f){B().feedback(f,t.dataset.a);B().toast(({useful:'Gracias: lo tendremos en cuenta.',not_interested:f.essential?'Lo mostraremos con menos énfasis, pero esta información es esencial y no se oculta.':'Listo: no volveremos a mostrarlo por un tiempo.',resolved:'Anotado como resuelto. Lo reevaluamos si cambia tu situación.',less:f.essential?'Lo mantenemos porque es un compromiso esencial.':'Mostraremos menos de este tipo.'})[t.dataset.a]);}
   const mods=MAP[B().page()]||null;openSheet(mods);mount();return}
 },true);
 document.addEventListener('change',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.vi==='doff'){B().memOp('setOff',{k:t.dataset.k,v:!t.checked});openSheet(MAP[B().page()]||null);mount();return}
 if(t&&t.dataset&&t.dataset.vi==='life'){B().setPref('life',t.checked);const mods=MAP[B().page()]||null;openSheet(mods);mount()}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){e.stopPropagation();closeSheet()}},true);

 window.ViveIntelUI=Object.freeze({mount,openSheet,closeSheet,MAP});
})();
