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
      if (!state || !header || !gallery) continue;

      // Mantener los manejadores originales y sus data-act: no clonar ni recrear.
      const fragment = document.createDocumentFragment();
      fragment.append(header, gallery);
      wallet.insertBefore(fragment, state);
      wallet.classList.add('wallet-carousel-restored');

      const toggle = wallet.querySelector('.wallet-mobile-tools > summary');
      if (toggle) {
        toggle.setAttribute('aria-label', 'Mostrar saldo y operaciones de tarjeta');
        toggle.setAttribute('title', 'Saldo y operaciones');
      }
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
