# 02 · Alcance

## Incluido en la versión actual
| Área | Pantallas / capacidades | Referencia |
|---|---|---|
| Inicio | Resumen financiero, Analítica avanzada, Patrimonio, Suscripciones, Entre personas | `app.js:3798` mapa `pages` |
| Bancos | Instituciones, Cuentas (y efectivo), Tarjetas, Préstamos, Certificados | `app.js:1228,3002,3010,1889,3872` |
| Operaciones | Movimientos, Ingresos, Egresos, Presupuestos, Categorías | `app.js:2258,2739,2689,2381,1339` |
| Wallet (solo móvil) | Galería de tarjetas con estado y actividad | `app.js:1091` (en escritorio redirige a Tarjetas, `app.js:1147`) |
| Pagos | Agenda de servicios y vencimientos | `app.js:1487,2275` |
| Apple Pay | Vinculación, bandeja «por sincronizar», importación | `app.js:12512-12700` |
| Exportación | CSV de movimientos; Excel anual (3 hojas) | `app.js:6074`, `advancedCsv` (`app.js:3912`) |
| Instalación | Manifiesto PWA e iconos | `manifest.webmanifest` |

## Fuera de alcance
Sin Service Worker (se eliminó `sw.js`; no hay uso sin conexión real, `README.md`), sin notificaciones push, sin backend propio más allá de Supabase, sin pruebas de integración contra Supabase real.

## Dependencias externas
| Dependencia | Uso | Evidencia |
|---|---|---|
| GitHub Pages | Hospedaje estático (rama `main`, raíz) | `README.md`; **sin** flujo de CI en el repo (`ls .github` vacío) |
| Supabase (Auth, PostgREST, Realtime, Edge Functions) | Backend único | `app.js:6849` URL `<REDACTADO>`, `app.js:6850` clave publicable `<REDACTADO>` |
| `cdn.jsdelivr.net` | Biblioteca `@supabase/supabase-js@2.119.0` | `index.html:35` (sin SRI) |
| Frankfurter y `open.er-api.com` | Tipo de cambio USD/DOP de referencia | `app.js:7058-7100` |
| Atajos de iOS / Wallet | Origen de las compras Apple Pay; el atajo llama a `apple-pay-shortcuts` | `app.js:12514-12519`; función edge en el proyecto (no en el repo) |
