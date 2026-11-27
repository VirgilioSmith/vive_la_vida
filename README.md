# vive el hoy · Finanzas 360 (VIVE V1)

PWA de finanzas personales en español (RD$ y US$). Sitio estático publicado en **GitHub Pages**; los datos viven en el dispositivo y se sincronizan con **un único proyecto Supabase (plan Free)**.

Ver de un vistazo cuánto tienes, cuánto debes y qué viene; registrar gastos, ingresos, pagos y préstamos sin hojas de cálculo. Todo sigue el acento elegido y los temas Claro y Black (motor Liquid Glass).

## Estructura

```text
index.html · manifest.webmanifest   entrada (sin Service Worker)
src/app.js                          lógica y vistas
src/*.css                           estilos (cascada por versión ?v=)
src/intelligence/                   VIVE Intelligence (motor + interfaz, cálculo local)
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

La CI (`.github/workflows/ci.yml`) ejecuta las suites en Chromium y WebKit en cada push a `main`.

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

## Incidente de arranque (27-nov-2026): VIVE se quedaba cargando

* **Causa raíz (reproducida):** la animación de polvo en `canvas` de la pantalla de arranque (`v980DismissSplash`, presente desde el 15-nov) solo cerraba la pantalla de carga desde un `requestAnimationFrame`. Si el navegador no ejecuta fotogramas (pestaña en segundo plano, ahorro de energía de Safari), la pantalla quedaba encima de la app ya cargada para siempre. Servidor, sesión y datos respondían bien (lecturas 200 en los registros de Supabase).
* **No fue la causa:** la política de versión mínima (`app_policy.min_client_version`) solo rechaza *escrituras* de clientes antiguos; no interviene en la lectura inicial ni en el arranque. No hay Service Worker (retirado el 14-nov; `sw.js` devuelve 404), ni Cache Storage, ni recargas automáticas.
* **Corrección** (`7908843`, `8840a4a`, `app.js?v=594`): la salida del arranque es síncrona y no depende de `canvas` ni de `requestAnimationFrame`. Además: tope de 8 s a la sesión y 25 s a la lectura inicial, y a los 40 s un vigilante muestra el último error real con «Reintentar» y «Volver a iniciar sesión» (descarta solo la sesión local; no toca datos).
* **Prueba de prevención:** `tests/arranque.js` (CI, Chromium y WebKit): sesión guardada en móvil y escritorio 2560×1440, sin sesión, restos de versiones antiguas, sesión dañada, Supabase caído / con 500 / colgado, y `requestAnimationFrame` congelado. Con el código anterior a la corrección, el caso del fotograma congelado falla; con el actual pasa.
* **Recuperación si vuelve a ocurrir:** recargar sin caché; si aparece la pantalla de error, «Reintentar» o «Volver a iniciar sesión». Los datos están en Supabase y no se modifican.
* **Riesgos pendientes:** Safari/iOS real no se ha probado manualmente (solo WebKit en CI); el servicio Realtime registra `MalformedJWT` en reconexiones del cliente (no bloquea el arranque, con tope de 8 reintentos; causa sin confirmar).

Reglas permanentes del proyecto: [`AGENTS.md`](AGENTS.md).
