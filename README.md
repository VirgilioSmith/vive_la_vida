# vive el hoy · Finanzas 360 — Versión 2

Nuevo ciclo de entregas. Paquete limpio: no contiene los 130+ informes, auditorías y registros de cambios anteriores.

## Contenido

- `index.html`: aplicación financiera completa basada en la V401; mantiene sus funciones y los esquemas de datos existentes.
- `manifest.webmanifest`, `sw.js` e iconos: recursos mínimos de instalación. El service worker **no almacena operaciones ni respuestas financieras**.
- `supabase/functions/apple-pay-shortcuts/`: función de entrada y normalización de importes Wallet.
- `docs/APPLE_PAY.md`: instalación y configuración de Atajos.

## Despliegue de la web

Publica el contenido de esta carpeta como raíz del sitio Netlify (el `index.html` debe quedar en la raíz). No borres ni reinstales tu base Supabase por cambiar el nombre de versión.

## Seguridad

No subas aquí claves `service_role`, tokens privados de Atajos ni datos bancarios reales. La función `apple-pay-shortcuts` requiere **`apple-pay-ingest` y `apple-pay-link` existentes**, y depende de que `apple-pay-ingest` verifique `X-Vive-Token`, el vínculo activo y la idempotencia.

La corrección de formato se ha probado localmente, pero **NO** se ha instalado ni ejecutado contra tu Supabase real.
