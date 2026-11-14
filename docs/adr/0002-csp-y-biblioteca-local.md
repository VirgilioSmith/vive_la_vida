# ADR 0002 · CSP por meta y supabase-js local
**Contexto:** GitHub Pages no permite cabeceras HTTP; la biblioteca venía de una CDN sin SRI y había scripts en línea.
**Decisión:** CSP por `<meta>` (`script-src 'self'`, `connect-src` solo Supabase y APIs de cambio), `vendor/supabase.js` fijo en 2.119.0 (hash en `vendor/supabase.js.sha384`), scripts en línea movidos a `early.js`.
**Consecuencias:** sin ejecución de scripts de terceros. `style-src` conserva `'unsafe-inline'` (la app usa estilos en línea). `frame-ancestors`, HSTS y `X-Frame-Options` no son posibles en GitHub Pages. Actualizar la biblioteca exige reemplazar el archivo y su hash.
