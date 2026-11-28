# vive el hoy · Finanzas 360 (VIVE V1)

PWA de finanzas personales en español (RD$ y US$). Sitio estático publicado en **GitHub Pages**; los datos viven en el dispositivo y se sincronizan con **un único proyecto Supabase (plan Free)**.

Ver de un vistazo cuánto tienes, cuánto debes y qué viene; registrar gastos, ingresos, pagos y préstamos sin hojas de cálculo. Todo sigue el acento elegido y los temas Claro y Black (motor Liquid Glass).

## Estructura

```text
index.html · manifest.webmanifest   entrada (sin Service Worker)
src/app.js                          lógica y vistas
src/*.css                           estilos (cascada por versión ?v=)
src/intelligence/                   VIVE Intelligence (motor + interfaz, cálculo local)
src/wrapped/                        VIVE Wrapped (historias de períodos cerrados, cálculo local)
src/liquid-glass.{css,js} · liquid-art.js   motor óptico y ilustraciones
src/supabase-rpc-guard.js           guardián del motor de sincronización
vendor/                             supabase-js (sin compilación)
supabase/migrations · rollback · tests · functions    base de datos (RLS) y Edge Functions de Apple Pay
tests/                              Playwright y Node
```

## Ejecutar y probar

No hay compilación: `python3 -m http.server 8000` y abre `http://localhost:8000`.

```bash
node tests/smoke.js            # recorrido general sin errores
node tests/sincronizacion-v1.js  # sincronización: cero reintentos infinitos, versión mínima
node tests/liquid-glass.js     # material óptico, accesibilidad, ilustraciones
node tests/regresion-visual.js # 72 capturas contra la línea base (--base para regenerarla)
```

### Siempre en los dos motores: Chromium y WebKit (Safari/iPhone)

VIVE se usa sobre todo en iPhone (Safari = WebKit). Todo cambio se prueba en **Chromium y en WebKit**:

```bash
node tests/arranque.js                          # Chromium: 17 escenarios de arranque
ARRANQUE_BROWSER=webkit node tests/arranque.js  # WebKit: los mismos 17 escenarios
```

Instalar WebKit una vez (Playwright ya trae Chromium):

```bash
npx playwright install webkit
npx playwright install-deps webkit
```

En una sesión en la nube de Claude, la red del entorno debe permitir `cdn.playwright.dev` y `playwright.download.prss.microsoft.com` para descargar WebKit.

Para revisar a ojo una pantalla en WebKit: `require('playwright').webkit.launch()` con `tests/harness.js` (mismo arnés que Chromium) y captura de la vista cambiada, en móvil (390 px, `TOUCH=1`) y PC (1440 px), Claro y Black.

La CI (`.github/workflows/ci.yml`) ejecuta `tests/arranque.js` y las suites de Wallet, conciliación y movimientos en Chromium **y** WebKit en cada push a `main`; un fallo en cualquiera de los dos motores es un fallo.

## Publicar

GitHub Pages desde `main`. Cada cambio de un archivo servido sube su `?v=` en `index.html` (o en `src/app.js` si lo carga de forma diferida).

## Supabase (un solo proyecto, plan Free)

* Escritura **solo** por la RPC `finance_apply_changes(p_expected_revision, p_changes, p_client_version)`: control de revisión, límites de tamaño/importe y **versión mínima** (`app_policy.min_client_version`). Un cliente por debajo de la mínima recibe un error terminal `VI001`: no guarda y no reintenta.
* RLS en todas las tablas; el cliente nunca recibe permisos de escritura directa.
* Versión mínima vigente: **1** (desde el 26-nov-2026 23:45 UTC). Para exigir una nueva: `update public.app_policy set min_client_version = N;` (volver a 0 lo revierte al instante).
* Sin *branches*, sin planes de pago, sin servicios extra.

## Recuperación

* Toda la historia está en `main`; el punto previo a la limpieza del 26-nov-2026 es el commit `0afd98a`. Restaurar: `git checkout -b recuperar 0afd98a`.
* Base de datos: migraciones en `supabase/migrations`, cada una con su `*.down.sql` en `supabase/rollback`.
* Los datos locales de un dispositivo con cambios sin sincronizar se guardan como copia de recuperación y se avisa al usuario.

## Incidente de arranque (27-nov-2026): VIVE se quedaba cargando en iPhone

* **Causa raíz (reproducida en WebKit, el motor de Safari):** `src/liquid-glass.js` (commit `13e76ad`, 26-nov 20:19, «Vive Liquid Glass Engine v1») calculaba `lite` como `(…)||(…)||(navigator.connection&&…)`. En Safari `navigator.connection` no existe, así que `lite` valía `undefined` y `classList.toggle('vlg-lite', undefined)` **alternaba** la clase en cada llamada. `evaluate()` se ejecutaba desde un `MutationObserver` de las clases de `<html>`: cada alternancia volvía a dispararlo → bucle infinito de microtareas justo después de «listo» → página congelada sobre la pantalla «vive el hoy». En Chrome `navigator.connection` existe y no ocurría; por eso las pruebas (solo Chromium) no lo veían y los trabajos WebKit de CI nunca terminaban.
* **Evidencia:** registros de Supabase del iPhone: lectura completa (12 páginas, revisión inicial y final con 200) y después nada; antes del 27-nov 11:55 Realtime llegaba a conectarse (se iniciaba antes del bucle), después ya no. En WebKit local, tres observadores (`liquid-glass.js:83`, `app.js:22333`, `vive-score/host.js:52`) superaban 100 000 llamadas en 10 s y la escritura venía de `evaluate@liquid-glass.js`.
* **Corrección:** `lite` siempre booleano y las clases de `<html>` solo se escriben si cambian (`liquid-glass.js?v=5`). Con la corrección, WebKit abre en ~1,7 s con una cuenta de la misma forma que la real (≈12 000 valores, datos sintéticos) y 29 vistas no muestran congelación ni tormentas de mutaciones.
* **Otras defensas del mismo incidente:** salida del arranque sin depender de animaciones (`8840a4a`); reintento de páginas cuyo cuerpo Safari no logra descargar («TypeError: Load failed», `771c209`); 8 s por intento de lectura, 45 s de carga y vigilante a 60 s (`94dd578`); etapas del arranque visibles en el error (`3b8d814`).
* **No fue la causa:** la política de versión mínima (solo rechaza escrituras), Service Workers (no hay), caché, Supabase (sano, datos íntegros: 11 990 valores sin huérfanos).
* **Prevención:** `tests/arranque.js` en CI con Chromium **y WebKit**: 17 escenarios; B17 simula un navegador sin `navigator.connection` y exige que la página siga respondiendo (falla con el código anterior). Regla: un observador nunca escribe el atributo que observa salvo que el valor cambie, y `classList.toggle` siempre recibe un booleano.
* **Recuperación:** recargar; si aparece la pantalla de error, «Reintentar», «Abrir Inicio sin restaurar la vista anterior» o «Volver a iniciar sesión». Los datos están en Supabase y no se modifican.
* **Riesgos pendientes:** prueba manual en un iPhone real (WebKit de escritorio no es idéntico a Safari iOS).

Reglas permanentes del proyecto: [`AGENTS.md`](AGENTS.md).

### Time Machine y Wrapped

Time Machine se abre desde Patrimonio o Notificaciones. Selecciona un día, un corte de comparación y RD$ o US$. El modelo patrimonial reconstruye los saldos a partir de aperturas y movimientos fechados. El flujo y los beneficios se muestran acumulados desde el primer día del mes. Los productos sin fecha verificable quedan fuera del corte. Los préstamos con reconstrucción contractual se identifican como estimados. La utilización requiere límites vigentes documentados. Queda pendiente reconstruir la vigencia de suscripciones y compromisos cuando exista historial suficiente.

La línea temporal muestra aperturas registradas, liquidaciones de capital verificables y extremos de los últimos 24 cierres mensuales consultables. Los extremos se omiten si faltan fechas de origen. En Wrapped, un acontecimiento lleva a su fecha y una escena de período lleva al cierre. Desde Time Machine se pueden abrir los Wrapped que ya se estrenaron y contienen el día seleccionado. El calendario y el archivo conservan la publicación a las 8:00 a. m. de Santo Domingo. Wrapped etiqueta como estimados los equivalentes que dependen de la tasa configurada. Los cálculos se hacen localmente con los registros ya cargados.

Pruebas de calendario y narración con `node tests/wrapped-unit.js`. Los recorridos cruzados, las monedas y los cortes se prueban con `node tests/time-machine.js`. La matriz de CI ejecuta ambos recorridos de navegador en Chromium y WebKit.

### VIVE Originals

Wrapped conserva los cinco estrenos programados y añade una edición especial sin calendario. Intelligence la admite tras verificar una liquidación de capital con abonos registrados en al menos seis meses distintos y principal original de RD$50.000 o US$1.000 como mínimo. Tras abrirla, la edición pasa al archivo en ese navegador.

Las escenas dependen de los registros del período. La evidencia mensual reutiliza los hallazgos de Intelligence. El contrapunto semanal simula una sola categoría contra la semana anterior, mantiene el resto constante y se omite cuando el equivalente depende de una tasa estimada. Los récords se limitan a los cierres comparables de Time Machine. El navegador guarda el capítulo y la fecha por sesión de usuario, con reanudación en el mismo dispositivo. Se reutilizan los cálculos y registros locales, sin consultas adicionales a Supabase.

`tests/wrapped-originals.js` verifica la edición especial, reanudación, repetición y viaje al acontecimiento en móvil y escritorio dentro de la matriz de Chromium y WebKit.

### Centro de Notificaciones

La campana abre a pantalla completa con los filtros Todo, Alertas y Wrapped. La lista operativa usa los mismos vencimientos, avisos de gasto y acciones de pago. «Limpiar todo» conserva el comportamiento local. Wrapped y Time Machine se abren encima del centro para conservar el filtro, el desplazamiento y el foco al volver. Las fechas, portadas y estrenos reutilizan el calendario de Wrapped.

`tests/notifications-center.js` recorre el centro en Claro, Black y oscuro, desde 320 px hasta 1920 px, incluyendo orientación horizontal. Se ejecuta en la matriz de Chromium y WebKit.
