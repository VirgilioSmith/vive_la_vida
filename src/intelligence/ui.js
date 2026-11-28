/* VIVE · INTELLIGENCE — presencia en la interfaz (carga bajo demanda).
   · Una franja delgada contextual por módulo (no añade opciones de navegación) y una hoja con todos los hallazgos.
   · Todo el cálculo es local (window.__viveIntel.run con caché invalidada por eventos). Sin polling ni suscripciones. */
(function(){
 'use strict';
 const B=()=>window.__viveIntel;
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ICON={critical:'!',attention:'!',opportunity:'↗',info:'i',recognition:'✓'};
 const GROUPS=[['critical','Crítico'],['attention','Requiere atención'],['opportunity','Oportunidades'],['info','Informativo'],['recognition','Reconocimiento']];
 const spark='<svg class="vi-spark" viewBox="0 0 24 24" aria-hidden="true"><path class="vi-spark-a" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><circle class="vi-spark-b" cx="19" cy="17" r="1.6"/><circle class="vi-spark-c" cx="5.5" cy="18" r="1.1"/></svg>';
 let open=null;

 const CHEV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
 /* Línea de inteligencia: UN solo componente para todas las vistas. items = hallazgos reales ya ordenados por relevancia; total = cuántos hay disponibles. */
 function show(el,item,extra){
  el.querySelector('strong').textContent=item.title;
  el.className='vi-strip vi-p-'+item.priority;
  el.title=item.title;
  el.setAttribute('aria-label','VIVE Intelligence: '+item.title+(extra?'. '+extra+(extra===1?' hallazgo más.':' hallazgos más.'):''));
 }
 function strip(items){
  const extra=items.length-1;
  const el=document.createElement('button');el.type='button';el.dataset.vi='open';el.setAttribute('aria-haspopup','dialog');
  el.innerHTML=`<span class="vi-mark">${spark}</span><span class="vi-copy"><strong></strong></span>${extra?`<span class="vi-more" aria-hidden="true">+${extra}</span>`:''}<span class="vi-chev" aria-hidden="true">${CHEV}</span>`;
  el.addEventListener('click',openSheet);
  show(el,items[0],extra);
  return el;
 }
 /* Dónde va: SIEMPRE justo debajo del título principal de la pantalla.
    PC: bajo el título de la barra superior (.topbar-intro). Móvil: bajo el encabezado propio de la página (h1 + su fila de controles); en Inicio, bajo el saludo.
    El subtítulo descriptivo estático de ese encabezado se retira: la línea de inteligencia ocupa su lugar. Sin lecturas de layout (sin reflow). */
 const hideSubs=root=>{if(!root)return;root.querySelectorAll(':scope > p,:scope > .top-sub').forEach(p=>{if(!p.querySelector('button,input,select,a,label,summary'))p.classList.add('vi-sub-off')})};
 function place(el,scope){
  const overlayTitle=scope.overlay?.querySelector('h1,h2');
  if(overlayTitle){overlayTitle.after(el);return true}
  const home=document.querySelector('.vive-mobile-home'),page=document.getElementById('page');
  const detail=page?.querySelector('[data-vi-heading],.v1190-card h1,.v56-profile-header h2,.vBanks-detail h1,.vbd-face h2');
  if(detail){detail.after(el);return true}
  const wide=!window.matchMedia('(max-width:790px)').matches;
  if(wide){const intro=document.querySelector('.topbar .topbar-intro'),t=intro&&intro.querySelector('.top-title');
   if(t){hideSubs(intro);t.after(el);return true}}
  if(home&&!wide){const g=home.querySelector('.vive-mobile-greeting');if(g&&g.nextSibling)home.insertBefore(el,g.nextSibling);else home.prepend(el);return true}
  const main=document.querySelector('#app main.main');
  const vis=e=>!e.closest('.topbar,[hidden],.modal,#modal-root')&&(!e.checkVisibility||e.checkVisibility({checkVisibilityCSS:true}));
  /* título propio de la página (h1); si la página abre directamente con un encabezado de sección (Anual, Proyección…), el primer h2 hace de título */
  const h1s=[...document.querySelectorAll('#page h1,#app main h1')].filter(e=>!e.closest('.topbar,[hidden],.modal,#modal-root'));
  /* El h2 solo hace de título cuando la página NO tiene ningún h1 (si lo tiene pero aún no es visible, se espera: nunca se mete la línea dentro de una tarjeta) */
  const h=h1s.find(vis)||(h1s.length?null:[...document.querySelectorAll('#page h2')].find(vis));
  if(h){let anchor=h;
   for(let n=0;n<4;n++){const p=anchor.parentElement;if(!p||p===page||p===main||p.id==='app'||p.querySelectorAll('*').length>45)break;anchor=p}
   hideSubs(h.parentElement);anchor.after(el);return true}
  return false;
 }
 let retry=null;
 let previousContext=null;
 const current=()=>B().active();
 function mount(stage=0){
  try{
   if(!stage&&retry){retry.forEach(clearTimeout);retry=null}
   if(!B())return;
   const view=current();
   if(previousContext!==view.revision){if(open)closeSheet();previousContext=view.revision}
   document.querySelectorAll('.vi-strip').forEach(n=>n.remove());
   document.querySelectorAll('.vi-sub-off').forEach(n=>n.classList.remove('vi-sub-off'));
   if(!view.items.length)return;
   const el=strip(view.items);
   const placed=place(el,view.scope);
   if(!stage&&!placed)retry=[90,220,450,800].map((ms,i)=>setTimeout(()=>{
    if(!document.querySelector('.vi-strip'))mount(i+1);
   },ms));
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
  const feedback=h.scopeKey?FB.filter(([id])=>D.SCOPED_FEEDBACK.includes(id)):FB;
  return `<article class="vi-card vi-disc ${VAL[h.valence]||'vi-p-info'}" data-vi-dkey="${esc(h.key)}">
   <header><span class="vi-ico" aria-hidden="true">✦</span><div><span class="vi-kicker">${esc(h.kicker||'Mira esto')}</span><h4>${esc(h.title)}</h4><div class="vi-tags"><span class="vi-kind vi-k-${esc(h.kind)}">${esc(window.ViveIntelligence.engines.narrative.kindLabel(h.kind))}</span><span class="vi-conf">Confianza ${esc(h.confidence.level)}</span></div></div></header>
   <p>${esc(h.summary)}</p>${h.question?`<div class="vi-ask"><span>${esc(h.question.text)}</span>${h.question.options.map(o=>`<button type="button" class="vi-chip" data-vi="dfb" data-a="${o[1]}">${esc(o[0])}</button>`).join('')}</div>`:(q?`<p class="vi-q">${esc(q)}</p>`:'')}
   ${howHTML(h)}
   <footer>${h.action?`<button type="button" class="vi-act" data-vi="go" data-target="${esc(h.action.target)}">${esc(h.action.label)} <span aria-hidden="true">→</span></button>`:'<span></span>'}
    <details class="vi-opts"><summary aria-label="Retroalimentación">Opciones</summary><div role="menu">${feedback.map(([a,l])=>`<button type="button" role="menuitem" data-vi="dfb" data-a="${a}">${esc(l)}</button>`).join('')}</div></details></footer></article>`;
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
 function sheetHTML(view){
  const discoveries=view.discoveries;
  const sections=GROUPS.map(([p,l])=>{
   const items=view.findings.filter(f=>f.priority===p);
   return items.length?`<section class="vi-group"><h3>${l}<span>${items.length}</span></h3>${items.map(card).join('')}</section>`:'';
  });
  if(discoveries.length)sections.splice(2,0,`<section class="vi-group"><h3>Descubrimientos<span>${discoveries.length}</span></h3>${discoveries.map(discCard).join('')}</section>`);
  return `<div class="vi-layer" data-vi="backdrop"><section class="vi-sheet" role="dialog" aria-modal="true" aria-labelledby="vi-title">
   <header class="vi-head"><button type="button" class="vi-back" data-vi="close" aria-label="Volver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m6-6-6 6 6 6"/></svg></button><div><h2 id="vi-title">${spark}VIVE Intelligence</h2></div></header>
   <div class="vi-body">${sections.join('')}</div>
  </section></div>`;
 }

 function openSheet(){
  closeSheet();if(!B())return;const view=current();if(!view.items.length)return;
  const wrap=document.createElement('div');wrap.innerHTML=sheetHTML(view);open=wrap.firstElementChild;document.body.appendChild(open);
  document.documentElement.classList.add('vi-open');
  const layer=open;
  layer.addEventListener('click',onSheetClick);
  layer.addEventListener('change',onSheetChange);
  layer.addEventListener('keydown',onSheetKey);
  layer.querySelector('.vi-back')?.focus({preventScroll:true});
  requestAnimationFrame(()=>{if(open===layer)layer.classList.add('is-in')});
 }
 function closeSheet(){if(open){open.remove();open=null}document.documentElement.classList.remove('vi-open')}

 function onSheetClick(e){
  const t=e.target.closest?.('[data-vi]');if(!t)return;
  const k=t.dataset.vi;
  if(!open)return;
  if(k==='backdrop'){if(e.target===t)closeSheet();return}
  if(k==='close'){closeSheet();return}
  if(k==='go'){const id=t.dataset.target;closeSheet();B().go(id);return}
  if(k==='why'){const c=t.closest('.vi-card');const w=c.querySelector('.vi-why');w.hidden=!w.hidden;t.closest('details')?.removeAttribute('open');return}
  if(k==='dfb'){const c=t.closest('.vi-card');const h=current().discoveries.find(x=>x.key===c.dataset.viDkey);
   if(h){B().discFeedback(h,t.dataset.a);B().toast(({correct:'Patrón confirmado y recordado.',incorrect:'Anotado: lo descartamos y ajustamos.',exception:'Excepción anotada: no altera tu línea base.',intentional:'Decisión intencional registrada.',known:'Entendido: lo silenciamos por un tiempo.',not_interested:'Listo: no lo mostraremos por un tiempo.',follow:'Lo seguiremos observando.',improve:'Meta de mejora creada.',helped:'Gracias: priorizaremos este tipo de hallazgo.',never:'No volverás a ver este tipo de hallazgo.'})[t.dataset.a]);}
   mount();openSheet();return}
  if(k==='dforget'){B().memOp('forget',t.dataset.key);mount();openSheet();return}
  if(k==='dforgetall'){if(window.confirm('¿Borrar todo lo que VIVE Intelligence ha aprendido? Tus movimientos no se tocan.')){B().memOp('forgetAll');B().toast('Conocimiento eliminado.');mount();openSheet()}return}
  if(k==='dexport'){const blob=new Blob([B().memOp('export')],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vive-conocimiento-personal.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);return}
  if(k==='sfut'||k==='slab'||k==='schain'){const box=open.querySelector('.vi-strat');const A=B().strategic();let h='';
   if(k==='sfut'){const r=A.horizon();h=!r.ok?`<p><small>${esc(r.reason)}</small></p>`:`${Object.values(r.futures).map(f=>`<div class="vi-fut"><b>${esc(f.label)}</b><small>${esc(f.assumptions)}</small><div class="vi-fut-g">${[30,90,365].map(x=>{const v=f.horizons[x];return `<span><i>${x} d</i><b>${money(v.p50)}</b><small>${money(v.p10)} – ${money(v.p90)}</small></span>`}).join('')}</div></div>`).join('')}<p><small>Disponibilidad = liquidez − deuda de tarjetas. Central y rango (p10–p90). ${esc(r.note)} ${esc(r.limits||'')}</small></p>`}
   else if(k==='slab'){const r=A.decisionLab();h=!r.ok?`<p><small>${esc(r.reason)}</small></p>`:r.alternatives.map(a=>`<details class="vi-how"><summary>${esc(a.label)}</summary><div class="vi-how-body"><p>${esc(a.description)}</p><dl><dt>Beneficios</dt><dd>${esc(a.benefits.join(' · '))}</dd><dt>Costos</dt><dd>${esc(a.costs.join(' · '))}</dd><dt>Incertidumbre</dt><dd>${esc(a.uncertainties.join(' · '))}</dd><dt>Reversibilidad / flexibilidad</dt><dd>${esc(a.reversibility)} / ${esc(a.flexibility)}</dd><dt>A 365 días</dt><dd>central ${money(a.futureImpact.p50_365)} · trayectorias negativas ${Math.round(a.futureImpact.pNeg_365*100)} %</dd></dl></div></details>`).join('')+`<p><small>${esc(r.note)}</small></p>`}
   else{const r=A.chain({label:'Nueva cuota',monthly:8000,down:0});h=['first','second','third','fourth'].map(o=>`<p><b>${esc(r[o].title)}</b><br>${esc(r[o].text)}</p>`).join('')+`<p><small>${esc(r.positives)} Supuestos: ${esc(r.assumptions.join(' · '))}.</small></p>`}
   box.innerHTML=h;return}
  if(k==='sans'){if(t.dataset.multi==='1'){t.classList.toggle('vi-on');return}B().answer(t.dataset.id,t.dataset.v);B().toast('Gracias: lo tendré en cuenta.');openSheet();return}
  if(k==='sdone'){const v=[...open.querySelectorAll('[data-vi="sans"].vi-on')].map(x=>x.dataset.v);if(v.length){B().answer(t.dataset.id,v);B().toast('Gracias: lo tendré en cuenta.');openSheet()}return}
  if(k==='dsim'){const sc=JSON.parse(t.dataset.sc||'{}');const r=B().simulate(sc);const box=open.querySelector('.vi-sim');const f=v=>'RD$'+Math.round(Math.abs(v)).toLocaleString('es-DO');
   box.innerHTML=r.ok?`<div class="vi-sim-grid"><div><small>Conservador</small><b>${(r.conservative<0?'-':'')+f(r.conservative)}</b></div><div><small>Central</small><b>${(r.central<0?'-':'')+f(r.central)}</b></div><div><small>Favorable</small><b>${(r.favorable<0?'-':'')+f(r.favorable)}</b></div></div><p><small>Liquidez estimada en ${r.months} meses. Probabilidad de quedar en negativo: ${Math.round(r.pNegative*100)} %. ${esc(r.assumptions.join(' · '))}. ${esc(r.note)}</small></p>`:`<p><small>${esc(r.reason)}</small></p>`;return}
  if(k==='fb'){
   const c=t.closest('.vi-card');const f=current().findings.find(x=>x.id===c.dataset.viId);
   if(f){B().feedback(f,t.dataset.a);B().toast(({useful:'Gracias: lo tendremos en cuenta.',not_interested:f.essential?'Lo mostraremos con menos énfasis, pero esta información es esencial y no se oculta.':'Listo: no volveremos a mostrarlo por un tiempo.',resolved:'Anotado como resuelto. Lo reevaluamos si cambia tu situación.',less:f.essential?'Lo mantenemos porque es un compromiso esencial.':'Mostraremos menos de este tipo.'})[t.dataset.a]);}
   mount();openSheet();return}
 }
 function onSheetChange(e){
  const t=e.target;
  if(t.dataset?.vi==='doff'){B().memOp('setOff',{k:t.dataset.k,v:!t.checked});mount();openSheet()}
  if(t.dataset?.vi==='life'){B().setPref('life',t.checked);mount();openSheet()}
 }
 function onSheetKey(e){if(e.key==='Escape'&&open){e.stopPropagation();closeSheet()}}

 window.ViveIntelUI=Object.freeze({mount,openSheet,closeSheet});
})();
