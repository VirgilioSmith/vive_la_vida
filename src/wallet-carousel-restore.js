/* VIVE Wallet móvil · rescate del carrusel de Crédito Global y tarjetas.
   La última composición dejó el carrusel dentro de <details> colapsado.
   Se reutilizan los nodos originales para preservar selección, swipe, datos y acciones.
   Exclusivo móvil; Wallet PC queda intacto. */
(() => {
  'use strict';
  const mobile = window.matchMedia('(max-width: 790px)');
  const app = document.getElementById('app');
  if (!app) return;

  function restore() {
    if (!mobile.matches) return;
    for (const wallet of app.querySelectorAll('main.world-wallet .v68-wallet')) {
      const state = wallet.querySelector(':scope > .v1244-state');
      const controls = wallet.querySelector('.wallet-mobile-tools-content');
      const header = controls?.querySelector(':scope > .v266-wallet-header');
      const gallery = controls?.querySelector(':scope > .v266-gallery');
      const balance = controls?.querySelector(':scope > .v266-selected-balance');
      const actions = controls?.querySelector(':scope > .v266-wallet-actions');
      if (!state || !header || !gallery || !balance || !actions) continue;

      // Reubicar los mismos nodos y controles: NO duplicar sus cálculos,
      // acciones ni los datos de la tarjeta elegida.
      const summary = document.createElement('section');
      summary.className = 'wallet-mobile-summary';
      summary.setAttribute('aria-label', 'Crédito disponible y deuda utilizada');
      summary.append(balance, actions);
      const fragment = document.createDocumentFragment();
      fragment.append(header, gallery, summary);
      wallet.insertBefore(fragment, state);
      wallet.classList.add('wallet-carousel-restored', 'wallet-summary-external');
      bindCarousel(gallery.querySelector('.v68-wallet-gallery'));

      // El disclosure queda vacío y oculto, pero su nodo permanece para que
      // el controlador nativo de swipe invoque la actualización de la tarjeta.
      const legacyDisclosure = wallet.querySelector('.wallet-mobile-tools');
      legacyDisclosure?.setAttribute('aria-hidden', 'true');
    }
  }


  // VIVE Wallet mobile: selection-in-place. The legacy data-act handler
  // rerendered the entire gallery on click, resetting its scroll position.
  // Preserve the rail and replace only financial data panels.
  function selectInPlace(rail, id, moveRail) {
    if (!mobile.matches || !rail?.isConnected || !id || typeof ui==='undefined' || ui.page!=='wallet') return;
    const wallet=rail.closest('.v68-wallet.wallet-summary-external');
    const target=[...rail.querySelectorAll('.v68-wallet-face[data-id]')].find(f=>f.dataset.id===id);
    if(!wallet || !target)return;
    if(ui.v68WalletId!==id){
      ui.v68WalletId=id;
      ui.v144WalletExpanded=true;
      const scratch=document.createElement('div');
      scratch.innerHTML=v68Wallet();
      const fresh=scratch.querySelector('.v68-wallet');
      const controls=fresh?.querySelector('.wallet-mobile-tools-content');
      const balance=controls?.querySelector(':scope > .v266-selected-balance');
      const actions=controls?.querySelector(':scope > .v266-wallet-actions');
      const updatedState=fresh?.querySelector(':scope > .v1244-state');
      const currentState=wallet.querySelector(':scope > .v1244-state');
      const summary=wallet.querySelector(':scope > .wallet-mobile-summary');
      if(fresh && balance && actions && updatedState && currentState && summary){
        // Reuse nodes only; the gallery remains connected throughout.
        summary.replaceChildren(balance,actions);
        const disclosure=currentState.querySelector(':scope > .wallet-mobile-tools');
        const placeholder=updatedState.querySelector(':scope > .wallet-mobile-tools');
        if(disclosure && placeholder)placeholder.replaceWith(disclosure);
        currentState.replaceWith(updatedState);
        const tailSelector=':scope > .v1244-cutpanel, :scope > .v371-card-return, :scope > .v1301-distribution, :scope > .v266-wallet-note';
        const oldTails=[...wallet.children].filter(e=>e.matches('.v1244-cutpanel,.v371-card-return,.v1301-distribution,.v266-wallet-note'));
        oldTails.forEach(e=>e.remove());
        [...fresh.children].filter(e=>e.matches('.v1244-cutpanel,.v371-card-return,.v1301-distribution,.v266-wallet-note')).forEach(e=>wallet.appendChild(e));
      }
    }
    rail.querySelectorAll('.v68-wallet-face[data-id]').forEach(f=>{
      const selected=f.dataset.id===id;
      f.classList.toggle('selected',selected);
      f.setAttribute('aria-pressed',String(selected));
    });
    wallet.querySelectorAll('.v68-wallet-dots button[data-id]').forEach(dot=>{
      const selected=dot.dataset.id===id;
      dot.classList.toggle('active',selected);
      dot.setAttribute('aria-current',String(selected));
    });
    const status=rail.parentElement?.querySelector('.v158-wallet-selection-status');
    if(status)status.textContent=target.getAttribute('aria-label')||'Tarjeta seleccionada';
    if(moveRail){
      const railBox=rail.getBoundingClientRect(),faceBox=target.getBoundingClientRect();
      const dx=faceBox.left-railBox.left;
      const next=Math.max(0,Math.min(rail.scrollWidth-rail.clientWidth,rail.scrollLeft+dx));
      if(Math.abs(next-rail.scrollLeft)>1)rail.scrollTo({left:next,behavior:'instant'});
    }
  }
  function nearestVisible(rail){
    const x=rail.getBoundingClientRect().left;
    let chosen=null,score=Infinity;
    rail.querySelectorAll('.v68-wallet-face[data-id]').forEach(face=>{
      const d=Math.abs(face.getBoundingClientRect().left-x);
      if(d<score){score=d;chosen=face}
    });
    return chosen;
  }
  function bindCarousel(rail){
    if(!rail || rail.dataset.walletStableBound)return;
    rail.dataset.walletStableBound='1';
    let timer=0;
    const settle=()=>{
      clearTimeout(timer);
      if(!rail.isConnected || !rail.closest('.wallet-summary-external'))return;
      const face=nearestVisible(rail);
      if(face)selectInPlace(rail,face.dataset.id,false);
    };
    // Resolve the selected data before the legacy V158 scroll handler
    // rerenders the page (its debounce is 120 ms).
    rail.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(settle,65)},{passive:true});
    rail.addEventListener('scrollend',settle,{passive:true});
  }
  // Capture before the delegated click handler invokes v139WalletChooseCard.
  document.addEventListener('click',event=>{
    const button=event.target.closest?.(
      '.wallet-summary-external .v68-wallet-gallery .v68-wallet-face[data-id],'+
      '.wallet-summary-external .v68-wallet-dots button[data-id],'+
      '.wallet-summary-external .wallet-mobile-select-card[data-id]'
    );
    if(!button)return;
    const rail=button.closest('.v68-wallet')?.querySelector('.v68-wallet-gallery');
    if(!rail)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectInPlace(rail,button.dataset.id,true);
  },true);

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      restore();
    });
  }
  const includesNewWallet = node => node.nodeType === 1 && (
    node.matches?.('.v68-wallet, .wallet-mobile-tools-content') ||
    !!node.querySelector?.('.wallet-mobile-tools-content > .v266-gallery')
  );
  const observer = new MutationObserver(changes => {
    if (!mobile.matches) return;
    if (changes.some(change => [...change.addedNodes].some(includesNewWallet))) schedule();
  });
  observer.observe(app, {childList: true, subtree: true});
  mobile.addEventListener?.('change', schedule);
  schedule();
})();
