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

      // El disclosure queda vacío y oculto, pero su nodo permanece para que
      // el controlador nativo de swipe invoque la actualización de la tarjeta.
      const legacyDisclosure = wallet.querySelector('.wallet-mobile-tools');
      legacyDisclosure?.setAttribute('aria-hidden', 'true');
    }
  }

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
