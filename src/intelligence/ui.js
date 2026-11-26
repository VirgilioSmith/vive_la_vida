/* VIVE · INTELLIGENCE — presencia en la interfaz (carga bajo demanda).
   · Una franja delgada contextual por módulo (no añade opciones de navegación) y una hoja con todos los hallazgos.
   · Todo el cálculo es local (window.__viveIntel.run con caché invalidada por eventos). Sin polling ni suscripciones. */
(function(){
 'use strict';
 const B=()=>window.__viveIntel;
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 /* página de la app → etiquetas de módulo que la hacen relevante */
 const MAP={overview:['overview'],mobilehub:['overview'],register:['register'],expenses:['register'],categories:['register'],income:['income'],
  banks:['banks','accounts'],accounts:['accounts','banks'],wallet:['cards','wallet'],cards:['cards','wallet'],loans:['loans'],patrimony:['patrimony'],
  certificates:['patrimony'],recurring:['recurring'],payments:['pressure','recurring'],pressure:['pressure'],budget:['budget'],personal:['personal'],benefits:['cards'],kpis:['overview']};
 const ICON={critical:'!',attention:'!',opportunity:'↗',info:'i',recognition:'✓'};
 const GROUPS=[['critical','Crítico'],['attention','Requiere atención'],['opportunity','Oportunidades'],['info','Informativo'],['recognition','Reconocimiento']];
 const spark='<svg class="vi-spark" viewBox="0 0 24 24" aria-hidden="true"><path class="vi-spark-a" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><circle class="vi-spark-b" cx="19" cy="17" r="1.6"/><circle class="vi-spark-c" cx="5.5" cy="18" r="1.1"/></svg>';
 let open=null;

 function forModule(res,mods){return res.findings.filter(f=>f.modules.some(m=>mods.includes(m)))}

 function strip(res,list,mods){
  const top=list[0];if(!top)return null;
  const el=document.createElement('button');el.type='button';el.className='vi-strip vi-p-'+top.priority;el.dataset.vi='open';el.dataset.viModule=mods[0];
  el.setAttribute('aria-haspopup','dialog');el.setAttribute('aria-label','VIVE Intelligence: '+top.title+(list.length>1?'. '+(list.length-1)+' más.':''));
  el.innerHTML=`<span class="vi-mark">${spark}</span><span class="vi-copy"><small>VIVE Intelligence · ${esc(res.__label||'')}</small><strong>${esc(top.title)}</strong></span>${list.length>1?`<span class="vi-more">+${list.length-1}</span>`:''}<span class="vi-chev" aria-hidden="true">›</span>`;
  return el;
 }

 /* Anfitrión visible: #page (PC y demás páginas) o la portada móvil de Inicio (tras el saludo) */
 function place(el){
  /* Sin lecturas de layout (getBoundingClientRect forzaría un reflow de toda la página en cada render):
     la portada móvil de Inicio existe en el DOM solo en móvil; en el resto se usa #page. */
  const home=document.querySelector('.vive-mobile-home'),page=document.getElementById('page');
  if(home&&window.matchMedia('(max-width:790px)').matches){const g=home.querySelector('.vive-mobile-greeting');if(g&&g.nextSibling)home.insertBefore(el,g.nextSibling);else home.prepend(el);return true}
  if(page&&page.parentElement){page.parentElement.insertBefore(el,page);return true}
  const m=document.querySelector('#app main.main');if(m){m.prepend(el);return true}return false
 }
 function mount(){
  try{
   document.querySelectorAll('.vi-strip').forEach(n=>n.remove());
   const b=B();if(!b)return;const mods=MAP[b.page()];if(!mods)return;
   const res=b.run();const list=forModule(res,mods);
   res.__label=({overview:'Inicio',register:'Movimientos',banks:'Bancos',accounts:'Cuentas',wallet:'Tarjetas',cards:'Tarjetas',loans:'Préstamos',patrimony:'Patrimonio',recurring:'Suscripciones',pressure:'Compromisos',income:'Ingresos',budget:'Presupuesto',personal:'Entre personas'})[b.page()]||'';
   let shown=list;let d=null;try{d=B().discover()}catch(_){}
   const top=list[0];
   if(d&&d.discoveries.length&&(!top||(top.priority!=='critical'&&top.priority!=='attention'))){const h=d.discoveries.find(x=>(x.modules||['overview']).some(m=>mods.includes(m)));
    if(h){const fake={...h,priority:h.valence==='risk'?'attention':h.valence==='positive'?'recognition':'info',title:h.title};shown=[fake,...list];res.__disc=h}}
   const el=strip(res,shown,mods);if(el){if(res.__disc){el.querySelector('.vi-copy small').textContent='VIVE Intelligence · '+(res.__disc.kicker||'Descubrimiento');res.__disc=null}place(el)}
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
 function howHTML(h){
  const x=window.ViveDiscovery.explain(h),w=x.how;
  const parts=Object.entries(w.confidence.parts).map(([k,v])=>`<li><span>${esc(k)}</span><b>${v}</b></li>`).join('');
  return `<details class="vi-how"><summary>${esc(w.title)}</summary><div class="vi-how-body">
   <dl><dt>¿Qué detectamos?</dt><dd>${esc(x.detected)}</dd>
   <dt>¿Qué información usamos?</dt><dd>${esc(w.periods)} · ${esc(w.comparison)}</dd>
   <dt>Evidencia</dt><dd><ul class="vi-ev">${w.evidence.map(e=>`<li><span>${esc(e.label)}</span><b>${esc(e.value)}</b></li>`).join('')}</ul></dd>
   <dt>Metodología</dt><dd>${esc(w.method)}</dd>
   <dt>¿Aislado o recurrente?</dt><dd>${esc(w.isolated)} · ${esc(w.recurrence)}</dd>
   <dt>Incertidumbre</dt><dd>${esc(w.uncertainty)} Confianza ${esc(w.confidence.level)} (puntuación de evidencia ${w.confidence.score}).<ul class="vi-ev">${parts}</ul><small>${esc(w.confidence.formula)}</small></dd>
   <dt>¿Por qué importa?</dt><dd>${esc(x.why)}</dd><dt>Si continúa</dt><dd>${esc(x.ifContinues)}</dd>
   ${x.counterfactual?`<dt>Escenario alternativo</dt><dd>${esc(x.counterfactual)}</dd>`:''}
   <dt>Alternativas</dt><dd><ul class="vi-alt">${x.alternatives.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></dd></dl><small>${esc(w.relevanceNote)}</small></div></details>`;
 }
 function discCard(h){
  const D=window.ViveDiscovery,q=D.reflect(h);
  return `<article class="vi-card vi-disc ${VAL[h.valence]||'vi-p-info'}" data-vi-dkey="${esc(h.key)}">
   <header><span class="vi-ico" aria-hidden="true">✦</span><div><span class="vi-kicker">${esc(h.kicker||'Mira esto')}</span><h4>${esc(h.title)}</h4><div class="vi-tags"><span class="vi-kind vi-k-${esc(h.kind)}">${esc(window.ViveIntelligence.engines.narrative.kindLabel(h.kind))}</span><span class="vi-conf">Confianza ${esc(h.confidence.level)}</span></div></div></header>
   <p>${esc(h.summary)}</p>${q?`<p class="vi-q">${esc(q)}</p>`:''}
   ${howHTML(h)}
   <footer>${h.action?`<button type="button" class="vi-act" data-vi="go" data-target="${esc(h.action.target)}">${esc(h.action.label)} <span aria-hidden="true">→</span></button>`:'<span></span>'}
    <details class="vi-opts"><summary aria-label="Retroalimentación">Opciones</summary><div role="menu">${FB.map(([a,l])=>`<button type="button" role="menuitem" data-vi="dfb" data-a="${a}">${esc(l)}</button>`).join('')}</div></details></footer></article>`;
 }
 const OFF=[['spending','Gastos y consumo'],['liquidity','Liquidez y vencimientos'],['habits','Hábitos y relaciones entre variables']];
 function knowHTML(disc){
  const D=window.ViveDiscovery,m=B().memory(),L=D.Memory.list(m),prof=disc.features.profile,au=disc.audit;
  const li=(a,fn)=>a.length?`<ul class="vi-kl">${a.map(fn).join('')}</ul>`:'<p class="vi-empty-s">Nada por ahora.</p>';
  const del=k=>`<button type="button" class="vi-del" data-vi="dforget" data-key="${esc(k)}" aria-label="Eliminar este conocimiento">Eliminar</button>`;
  const sim=(l,sc)=>`<button type="button" class="vi-chip" data-vi="dsim" data-sc='${esc(JSON.stringify(sc))}'>${esc(l)}</button>`;
  const fbCount=m.fb.length;
  return `<details class="vi-know"><summary>Lo que Vive sabe de ti</summary><div class="vi-know-body">
   <h5>Madurez del aprendizaje</h5><p><b>${esc(prof.maturity)}</b> — ${esc(prof.maturityBasis)}</p>
   <h5>Fuentes autorizadas</h5><ul class="vi-kl"><li><span>Finanzas (movimientos, cuentas, tarjetas, préstamos, suscripciones)</span><b>Activa · solo en tu dispositivo</b></li><li><span>Bienestar, Mi garaje, Metas, VIVE Consciente</span><b>Sin datos guardados en la app</b></li><li><span>Servicios externos de IA</span><b>No se usan</b></li></ul>
   <h5>Patrones confirmados</h5>${li(L.patterns,x=>`<li><span>${esc(x.title)}</span>${del(x.key)}</li>`)}
   <h5>Hipótesis en observación (aún no se comunican)</h5>${li([...disc.internal.filter(h=>!['discarded','resolved'].includes(h.state)).map(h=>({key:h.key,title:h.title,n:h.seenDays,need:h.minSeen||2})),...L.hypotheses.filter(h=>!disc.internal.some(i=>i.key===h.key)).map(h=>({key:h.key,title:h.title,n:(h.seen||[]).length,need:2}))].slice(0,6),x=>`<li><span>${esc(x.title)}<small> · ${x.n}/${x.need} evaluaciones</small></span>${del(x.key)}</li>`)}
   <h5>En seguimiento y metas</h5>${li([...L.following,...L.goals],x=>`<li><span>${esc(x.title)}</span>${del(x.key)}</li>`)}
   <h5>Excepciones y decisiones conocidas</h5>${li(L.exceptions,x=>`<li><span>${esc(x.title||x.key)}<small> · ${esc(({exception:'excepción',intentional:'intencional',known:'ya lo sabías',incorrect:'no era correcto',not_interested:'sin interés'})[x.why]||x.why)}</small></span>${del(x.key)}</li>`)}
   <h5>Aprendizaje por categoría</h5><div class="vi-toggles">${OFF.map(([k,l])=>`<label class="vi-life"><input type="checkbox" data-vi="doff" data-k="${k}" ${(m.prefs.off&&m.prefs.off[k])?'':'checked'}><span><strong>${l}</strong><small>${(m.prefs.off&&m.prefs.off[k])?'Desactivado':'Activo'}</small></span></label>`).join('')}</div>
   <h5>¿Qué pasaría si…? (simulación bajo demanda)</h5><div class="vi-chips">${sim('Gasto +10 %',{expensePct:10})}${sim('Ingresos −20 %',{incomePct:-20})}${sim('Eliminar RD$5,000/mes de gasto',{removeMonthly:5000})}${sim('Mantener el ritmo actual',{})}</div><div class="vi-sim" aria-live="polite"></div>
   <h5>Retroalimentación recibida</h5><p>${fbCount?`${fbCount} respuestas recientes; ajustan el peso de cada motor (${Object.entries(m.w).map(([k,v])=>k+' ×'+v).join(', ')||'sin cambios'}).`:'Aún no has dado retroalimentación.'}</p>
   <h5>Diagnóstico técnico</h5><details class="vi-diag"><summary>Ejecución de motores</summary><table class="vi-t"><tr><th>Motor</th><th>ms</th><th>Resultado</th></tr>${au.engines.map(e=>`<tr><td>${esc(e.id)} <small>(${esc(e.frequency||'')})</small></td><td>${e.ms!=null?e.ms:'—'}</td><td>${e.error?'error: '+esc(e.error):e.skipped?esc(e.skipped):e.produced+' hipótesis'}</td></tr>`).join('')}</table>
    <p><small>${au.features.days} días · ${au.features.weeks} semanas · ${au.features.records} registros · características ${au.features.ms} ms · total ${au.ms} ms · memoria ${au.memoryBytes} bytes · ${au.surfaced} visibles de ${au.hypotheses}. Descartados: ${au.discarded.length}.</small></p>
    <ul class="vi-kl">${au.discarded.slice(0,8).map(d=>`<li><span>${esc(d.key)}</span><b>${esc(d.reason)}</b></li>`).join('')}</ul></details>
   <div class="vi-know-actions"><button type="button" class="vi-chip" data-vi="dexport">Exportar mi conocimiento</button><button type="button" class="vi-chip vi-danger" data-vi="dforgetall">Borrar todo lo aprendido</button></div></div></details>`;
 }
 function sheetHTML(res,mods){
  const all=res.findings;const mine=mods?forModule(res,mods):[];const ordered=mine.length?[...mine,...all.filter(f=>!mine.includes(f))]:all;
  const by=p=>ordered.filter(f=>f.priority===p);
  let disc=null;try{disc=B().discover()}catch(e){console.warn('[Intelligence] discover',e)}
  const dsec=disc&&disc.discoveries.length?`<section class="vi-group"><h3>Descubrimientos<span>${disc.discoveries.length}</span></h3>${disc.discoveries.map(discCard).join('')}</section>`:'';
  const body=GROUPS.map(([p,l])=>{const a=by(p);const g=a.length?`<section class="vi-group"><h3>${l}<span>${a.length}</span></h3>${a.map(card).join('')}</section>`:'';return (p==='attention'?g+dsec:g)}).join('').replace(/^$/,'')||(dsec||'<p class="vi-empty">Por ahora no hay nada que destacar. VIVE Intelligence sigue aprendiendo en silencio y vuelve a evaluar cuando registres o cambies información.</p>');
  const know=disc?knowHTML(disc):'';
  const bodyFinal=(!/Descubrimientos<span>/.test(body)&&dsec)?dsec+body:body;
  const q=res.meta.quality||{};
  const life=B().prefs().life;
  return `<div class="vi-layer" data-vi="backdrop"><section class="vi-sheet" role="dialog" aria-modal="true" aria-labelledby="vi-title">
   <header class="vi-head"><button type="button" class="vi-back" data-vi="close" aria-label="Volver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m6-6-6 6 6 6"/></svg></button><div><h2 id="vi-title">${spark}VIVE Intelligence</h2><p>Observa, relaciona, anticipa y recomienda. No ejecuta pagos ni cambios.</p></div></header>
   <div class="vi-body">${bodyFinal}${know}</div>
   <footer class="vi-foot"><label class="vi-life"><input type="checkbox" data-vi="life" ${life?'checked':''}><span><strong>Lecturas de estilo de vida (opcional)</strong><small>Solo cifras registradas; no infiere emociones ni salud.</small></span></label>
    <small class="vi-meta">${res.meta.rules} reglas · ${res.findings.length} mostrados · cálculo local${res.meta.ms!=null?' · '+res.meta.ms+' ms':''}${q.months!=null?' · '+q.months+' mes(es) completos':''}</small></footer>
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
  if(k==='dfb'){const c=t.closest('.vi-card');const d=B().discover();const h=[...d.discoveries,...d.internal].find(x=>x.key===c.dataset.viDkey);
   if(h){B().discFeedback(h,t.dataset.a);B().toast(({correct:'Patrón confirmado y recordado.',incorrect:'Anotado: lo descartamos y ajustamos.',exception:'Excepción anotada: no altera tu línea base.',intentional:'Decisión intencional registrada.',known:'Entendido: lo silenciamos por un tiempo.',not_interested:'Listo: no lo mostraremos por un tiempo.',follow:'Lo seguiremos observando.',improve:'Meta de mejora creada.',helped:'Gracias: priorizaremos este tipo de hallazgo.',never:'No volverás a ver este tipo de hallazgo.'})[t.dataset.a]);}
   const mods=MAP[B().page()]||null;openSheet(mods);mount();return}
  if(k==='dforget'){B().memOp('forget',t.dataset.key);openSheet(MAP[B().page()]||null);mount();return}
  if(k==='dforgetall'){if(window.confirm('¿Borrar todo lo que VIVE Intelligence ha aprendido? Tus movimientos no se tocan.')){B().memOp('forgetAll');B().toast('Conocimiento eliminado.');openSheet(MAP[B().page()]||null);mount()}return}
  if(k==='dexport'){const blob=new Blob([B().memOp('export')],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vive-conocimiento-personal.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);return}
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
