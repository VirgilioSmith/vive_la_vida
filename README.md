# Vive el hoy · Finanzas 360 — V10 (Supabase en vivo)

- Fuente de datos: public.finanzas_estado (documento completo con control de versión), filtrado por usuario autenticado.
- Recepción de actualizaciones de otros dispositivos: Supabase Realtime por user_id, con comprobación del sello remoto cada 20 segundos y al volver a enfocar la app.
- Si la red está caída o el documento financiero no ha sido confirmado por Supabase, se bloquea la vista provisional y se ofrece reintento; el borrador permanece localmente protegido.
- Escrituras con control optimista mediante actualizado_en y conciliación de tres vías para preservar registros. Conflictos irreconciliables: se conservan ambos estados y NO se sobrescribe el servidor.
- Borrados y otras operaciones son parte del mismo documento financiero, sin una segunda tabla ni una deducción adicional.
- La integridad de la sincronización depende también de que todos los dispositivos utilicen una versión compatible; no instalar versiones anteriores en paralelo.
- Sin cambiar Apple Pay Edge Functions o los secretos de los tokens.

IMPORTANTE: Esta entrega contiene la app completa. Subir todo el contenido de esta carpeta al sitio; no se ha desplegado automáticamente en Netlify ni GitHub.
