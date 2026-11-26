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
   const el=strip(res,list,mods);if(el)place(el);
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

 function sheetHTML(res,mods){
  const all=res.findings;const mine=mods?forModule(res,mods):[];const ordered=mine.length?[...mine,...all.filter(f=>!mine.includes(f))]:all;
  const by=p=>ordered.filter(f=>f.priority===p);
  const body=GROUPS.map(([p,l])=>{const a=by(p);return a.length?`<section class="vi-group"><h3>${l}<span>${a.length}</span></h3>${a.map(card).join('')}</section>`:''}).join('')||'<p class="vi-empty">Por ahora no hay nada que destacar. VIVE Intelligence vuelve a evaluar cuando registres o cambies información.</p>';
  const q=res.meta.quality||{};
  const life=B().prefs().life;
  return `<div class="vi-layer" data-vi="backdrop"><section class="vi-sheet" role="dialog" aria-modal="true" aria-labelledby="vi-title">
   <header class="vi-head"><button type="button" class="vi-back" data-vi="close" aria-label="Volver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m6-6-6 6 6 6"/></svg></button><div><h2 id="vi-title">${spark}VIVE Intelligence</h2><p>Observa, relaciona, anticipa y recomienda. No ejecuta pagos ni cambios.</p></div></header>
   <div class="vi-body">${body}</div>
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
  if(k==='fb'){
   const c=t.closest('.vi-card');const res=B().run();const f=res.all.find(x=>x.id===c.dataset.viId)||res.findings.find(x=>x.id===c.dataset.viId);
   if(f){B().feedback(f,t.dataset.a);B().toast(({useful:'Gracias: lo tendremos en cuenta.',not_interested:f.essential?'Lo mostraremos con menos énfasis, pero esta información es esencial y no se oculta.':'Listo: no volveremos a mostrarlo por un tiempo.',resolved:'Anotado como resuelto. Lo reevaluamos si cambia tu situación.',less:f.essential?'Lo mantenemos porque es un compromiso esencial.':'Mostraremos menos de este tipo.'})[t.dataset.a]);}
   const mods=MAP[B().page()]||null;openSheet(mods);mount();return}
 },true);
 document.addEventListener('change',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.vi==='life'){B().setPref('life',t.checked);const mods=MAP[B().page()]||null;openSheet(mods);mount()}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){e.stopPropagation();closeSheet()}},true);

 window.ViveIntelUI=Object.freeze({mount,openSheet,closeSheet,MAP});
})();
