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
* Para exigir una versión nueva: `update public.app_policy set min_client_version = N;` (volver a 0 lo revierte al instante).
* Sin *branches*, sin planes de pago, sin servicios extra.

## Recuperación

* Toda la historia está en `main`; el punto previo a la limpieza del 26-nov-2026 es el commit `0afd98a`. Restaurar: `git checkout -b recuperar 0afd98a`.
* Base de datos: migraciones en `supabase/migrations`, cada una con su `*.down.sql` en `supabase/rollback`.
* Los datos locales de un dispositivo con cambios sin sincronizar se guardan como copia de recuperación y se avisa al usuario.

Reglas permanentes del proyecto: [`AGENTS.md`](AGENTS.md).
