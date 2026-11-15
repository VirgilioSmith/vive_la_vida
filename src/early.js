/* v866-direct-component-assembly */
/* V866: Montaje síncrono de vistas existentes. No oculta contenido ni inserta overlays. */
window.__v866Runners=Object.create(null);
window.__v866Compose=function(){
 const order=['v785','v790','v794','financial','v797','v798','v799','f834','f835','f836','f837','v844','v849','v854','v855','v857','v861','v864','v865'];
 for(let pass=0;pass<2;pass++)for(const name of order){
  const fn=window.__v866Runners[name];
  if(typeof fn==='function')try{fn()}catch(err){console.error('[V866] Componente '+name,err)}
 }
};

/* v386-early-submit-guard */
document.addEventListener('submit',function(e){if(e.target?.id==='recurringForm'&&typeof window.v386ValidateRecurringForm==='function')window.v386ValidateRecurringForm(e);},true);

/* vive-feature-flag */
window.VIVE_ENABLED=window.VIVE_ENABLED!==false;

/* Resiliencia: captura global de errores y red con tiempo de espera.
   Los registros nunca incluyen datos financieros: solo el tipo y un mensaje corto. */
(function () {
  'use strict';
  var VENTANA_ERRORES_MS = 60 * 1000;        // ventana para contar errores repetidos
  var UMBRAL_ERRORES_REPETIDOS = 5;           // a partir de aquí se avisa en consola una sola vez por ventana
  var ESPERA_LECTURA_MS = 20 * 1000;          // tiempo máximo de una lectura
  var ESPERA_ESCRITURA_MS = 30 * 1000;        // tiempo máximo de una escritura
  var REINTENTOS_MAXIMOS = 3;                 // solo lecturas, nunca escrituras
  var ESPERA_BASE_MS = 400;                   // espera creciente: 400, 800, 1600 ms
  var CODIGOS_REINTENTABLES = [502, 503, 504];
  var MENSAJE_MAXIMO = 160;

  var recientes = [];
  var avisado = false;
  function registrar(tipo, mensaje) {
    var ahora = Date.now();
    recientes = recientes.filter(function (t) { return ahora - t < VENTANA_ERRORES_MS; });
    recientes.push(ahora);
    window.__erroresRecientes = recientes.length;
    var texto = String(mensaje == null ? '' : mensaje).replace(/\s+/g, ' ').slice(0, MENSAJE_MAXIMO);
    if (recientes.length >= UMBRAL_ERRORES_REPETIDOS && !avisado) {
      avisado = true;
      console.warn('[alerta] Errores repetidos (' + recientes.length + ' en 1 min). Último: ' + tipo + ' · ' + texto);
      setTimeout(function () { avisado = false; }, VENTANA_ERRORES_MS);
    }
  }
  window.addEventListener('error', function (e) { registrar('error', e && e.message); });
  window.addEventListener('unhandledrejection', function (e) { registrar('promesa', e && e.reason && (e.reason.message || e.reason)); });

  var fetchOriginal = window.fetch && window.fetch.bind(window);
  if (!fetchOriginal || typeof AbortController === 'undefined') return;
  var esperar = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  window.fetch = function (entrada, opciones) {
    var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
    if (!/\.supabase\.co\//.test(url)) return fetchOriginal(entrada, opciones);
    var metodo = String((opciones && opciones.method) || (entrada && entrada.method) || 'GET').toUpperCase();
    var lectura = metodo === 'GET' || metodo === 'HEAD';
    var intentos = lectura ? REINTENTOS_MAXIMOS : 0;
    var limite = lectura ? ESPERA_LECTURA_MS : ESPERA_ESCRITURA_MS;
    var intento = function (n) {
      var control = new AbortController();
      var externa = opciones && opciones.signal;
      if (externa) { if (externa.aborted) control.abort(); else externa.addEventListener('abort', function () { control.abort(); }, { once: true }); }
      var reloj = setTimeout(function () { control.abort(); }, limite);
      var conSenal = Object.assign({}, opciones || {}, { signal: control.signal });
      return fetchOriginal(entrada, conSenal).then(function (resp) {
        clearTimeout(reloj);
        if (CODIGOS_REINTENTABLES.indexOf(resp.status) >= 0 && n < intentos) {
          return esperar(ESPERA_BASE_MS * Math.pow(2, n)).then(function () { return intento(n + 1); });
        }
        return resp;
      }, function (err) {
        clearTimeout(reloj);
        if (externa && externa.aborted) throw err;
        if (n < intentos) return esperar(ESPERA_BASE_MS * Math.pow(2, n)).then(function () { return intento(n + 1); });
        throw err;
      });
    };
    return intento(0);
  };
})();
