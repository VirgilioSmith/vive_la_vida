# vive el hoy · Finanzas 360

PWA de finanzas personales en español. Sitio estático (GitHub Pages) con Supabase como respaldo/sincronización.

## Estructura
- `index.html` – cascarón mínimo: metas, enlaces a `styles.css` y `app.js`, tres scripts de arranque en la cabecera.
- `styles.css` – todos los estilos (cascada por versiones; se resuelve con `!important` y mayor especificidad).
- `app.js` – toda la lógica y las vistas.
- `manifest.webmanifest`, `app-icon-*.png`, `favicon-v201.png` – instalación como PWA.
- `docs/AVANCE.md` – notas de avance del registro.

## Publicar (GitHub Pages)
Rama `main`, carpeta raíz. Tras cambiar `styles.css` o `app.js`, sube el número de `?v=` en `index.html` para romper la caché del navegador.

## Supabase
- Clave publicable en el cliente (la seguridad depende de RLS en las tablas `finanzas_estado`, `finance_revision`, `apple_pay_events`, `apple_pay_links`).
- Escrituras con reintento y espera creciente; sincronización por canales realtime.
- Las funciones edge `apple-pay-link` / `apple-pay-shortcuts` no están en este repositorio.
- La app no envía notificaciones push; las alertas son internas.
- Librería fijada: `@supabase/supabase-js@2.119.0` (jsDelivr).
