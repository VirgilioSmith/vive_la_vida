/* VIVE · teclado numérico nativo para formularios móviles.
   Sólo cambia inputmode; no cambia valores, tipos, validación, foco o estilos. */
(() => {
  'use strict';

  const original = new WeakMap();
  const isMobileWeb = () =>
    window.matchMedia('(max-width: 790px)').matches &&
    (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

  const words = value => String(value || '')
    .replace(/([a-záéíóúñ])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();

  const integerIdentity = /\b(day|days|dia|dias|pay day|cut day|due day|month|months|mes|meses|year|years|años|ano|term count|termcount|duration|duracion|period|periods|periodos|installment count|installments count|cantidad|quantity|qty|count|numero de cuotas|número de cuotas|quincenas|fortnights)\b/;
  const decimalIdentity = /\b(amount|importe|monto|principal|capital|balance|saldo|debt|deuda|rate|tasa|fx|interest|interes|interés|fee|commission|comision|comisión|cost|costo|price|precio|limit|limite|límite|income|ingreso|deduction|deduccion|deducción|tax|impuesto|gross|net|neto|anualidad|cuota|benefit value)\b/;
  const labelInteger = /\b(día de (pago|corte|cobro)|número de (cuotas|meses|días)|cantidad de (cuotas|pagos)|duración en (meses|días)|plazo en (meses|días))\b/;
  const labelDecimal = /\b(importe|monto|saldo|balance|capital|inter[eé]s|tasa|comisi[oó]n|costo|precio|l[ií]mite|deuda|anualidad|cuota|porcentaje)\b|%|RD\$|US\$/i;
  const nonFinancial = /\b(pin|otp|clave|código|codigo|contraseña|password|telefono|teléfono|phone|busqueda|búsqueda|search)\b/;

  function classify(input) {
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    if (type === 'number') {
      const step = (input.getAttribute('step') || '').trim().toLowerCase();
      if (step === 'any') return 'decimal';
      const n = Number(step);
      return step && Number.isFinite(n) && n > 0 && !Number.isInteger(n) ? 'decimal' : 'numeric';
    }
    if (type !== 'text') return null;
    const identity = words([input.name, input.id, input.getAttribute('data-field')].filter(Boolean).join(' '));
    if (nonFinancial.test(identity)) return null;
    if (integerIdentity.test(identity)) return 'numeric';
    if (decimalIdentity.test(identity)) return 'decimal';
    const labels = input.labels ? [...input.labels].map(label => label.textContent).join(' ') : '';
    const label = words([input.getAttribute('aria-label'), labels,
      input.closest('label')?.textContent].filter(Boolean).join(' '));
    if (labelInteger.test(label)) return 'numeric';
    if (labelDecimal.test(label)) return 'decimal';
    return null;
  }

  function configure(input) {
    if (!(input instanceof HTMLInputElement)) return;
    if (!isMobileWeb()) {
      if (original.has(input)) {
        const was = original.get(input);
        if (was === null) input.removeAttribute('inputmode');
        else input.setAttribute('inputmode', was);
        original.delete(input);
      }
      return;
    }
    // Respetar los campos que ya eligen su propio teclado (tel, email, etc.).
    if (!original.has(input) && input.hasAttribute('inputmode')) return;
    const mode = classify(input);
    if (!mode) return;
    if (!original.has(input)) original.set(input, input.getAttribute('inputmode'));
    if (input.getAttribute('inputmode') !== mode) input.setAttribute('inputmode', mode);
  }

  function scan(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches('input')) configure(node);
    node.querySelectorAll('input').forEach(configure);
  }

  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      scan(document.body);
    });
  };

  function start() {
    scan(document.body);
    const watcher = new MutationObserver(mutations => {
      if (mutations.some(m => m.type === 'childList' || m.attributeName === 'type' ||
        m.attributeName === 'name' || m.attributeName === 'step')) refresh();
    });
    watcher.observe(document.body, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['type', 'name', 'step']
    });
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', refresh, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
