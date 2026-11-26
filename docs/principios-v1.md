# Principios definitivos de VIVE V1

| # | Principio | Cómo se hace cumplir | Estado |
|---|---|---|---|
| 1 | **Una única versión oficial** | `main` es la única rama oficial; las 71 ramas remotas ya están fusionadas en `main`. Versión del motor de sincronización: `VIVE_CLIENT_VERSION = 1`. | Parcial: ramas sin borrar (pendiente de tu autorización); release 1.0.0 sin crear |
| 2 | **Una única web de producción** | GitHub Pages desde `main`. Sin Service Worker (no hay cachés antiguas persistentes); no hay referencias a otros despliegues (Netlify/Vercel/Firebase) en el código ni en los workflows. | Verificado en el repositorio |
| 3 | **Un único motor de sincronización** | Escritura solo por la RPC `finance_apply_changes` (cliente: `v405Commit`, con control de revisión y fusión a tres vías). `supabase-rpc-guard.js` es un guardián del mismo motor, no otro. | Verificado por pruebas (`sincronizacion-v1`) |
| 4 | **Cero reintentos infinitos** | Conflicto: espera 5 s→2 min y pausa a los 3; error de servidor: retroceso hasta 5 min y pausa a los 3; versión obsoleta: **ningún** reintento. El guardián bloquea la misma revisión 20 min. | Verificado: 1 llamada ante versión obsoleta y 0 durante 18 s; ≤ 2 llamadas en 45 s ante conflicto permanente |
| 5 | **Cero versiones obsoletas autorizadas para escribir** | Tabla `app_policy.min_client_version` + parámetro `p_client_version` en la RPC: un cliente por debajo de la mínima recibe `VI001` (terminal) sin tocar datos. | Cliente y migración listos. **La migración NO está aplicada a producción** (espera tu aprobación) |
| 6 | **Conservación íntegra de los datos financieros** | Ningún rechazo escribe; el cliente protege los cambios locales como copia de recuperación; la migración no toca datos y tiene rollback. Medido hoy: 292 registros y revisión 1062 intactos tras cerrar sesiones. | Verificado |
| 7 | **Supabase Free, sin servicios adicionales** | La migración añade 1 tabla de 1 fila y 1 función; sin Edge Functions nuevas, sin Realtime nuevo, sin *branches* (son de pago). Proyecto actual: 25 MB y 4 usuarios. | Verificado en datos; el plan y la facturación no son visibles desde aquí: revisa Billing → Usage |

## Despliegue seguro de la versión mínima (en dos pasos)

1. Aplicar `supabase/migrations/20261126000000_politica_version_minima.sql` con `min_client_version = 0`: ningún cliente cambia de comportamiento (los antiguos cuentan como versión 0, que ≥ 0).
2. Cuando todos los dispositivos usen la versión nueva: `update public.app_policy set min_client_version = 1;` Desde ese momento un cliente anterior no puede escribir y recibe un error terminal. Cualquier problema: `UPDATE ... SET min_client_version = 0` (inmediato) o el rollback `supabase/rollback/20261126000000_politica_version_minima.down.sql`.

Compatibilidad: el cliente nuevo detecta un servidor sin la política (error `PGRST202`) y reintenta **una sola vez** con la firma antigua; probado.

## Incidente del 26-nov-2026 (origen de estos principios)
~3.600 errores `CONFLICT` por hora durante ~21 h desde dos clientes con revisión obsoleta (1014 y 1056 frente a 1062). Sin pérdida de datos (cada rechazo ocurre antes de escribir). Contención: cierre de las 38 sesiones de la cuenta afectada; verificación de fin del bucle programada.

## Pendiente
* Aplicar la migración (necesita tu aprobación).
* La migración `20261119000000_limpieza_buenas_practicas.sql` del repositorio tampoco figura aplicada en producción (siguen las políticas `*_owner` con `ALL` y 4 índices sin uso): pendiente de revisar y aprobar.
* Activar «Leaked password protection» en Auth (ajuste de panel de Supabase; lo hace el titular).
* Borrado de ramas fusionadas, etiqueta `v1.0.0` y release de GitHub (necesitan tu autorización).
