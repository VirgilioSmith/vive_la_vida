# Paso a producción y reversión

## Ya aplicado en producción (14-nov-2026)
| Cambio | Prueba previa | Reversión |
|---|---|---|
| Migración `security_least_privilege_finance_tables` (revoca `anon`, solo `SELECT` a usuarios, escritura vía RPC `SECURITY DEFINER`) | `docs/security/pruebas_rls.sql` ejecutada en transacción deshecha **antes** y verificada **después** (privilegios consultados) | `docs/security/migracion_rls_privilegios_REVERSION.sql` |
| Migración V1043 `finance_collection_state` | Probada con rollback | `drop table public.finance_collection_state;` y restaurar `finance_apply_changes` previo (ver `docs/SUPABASE.md`) |

## Pendiente de desplegar (requiere tu decisión)
Las funciones edge endurecidas están en `supabase/functions/*` con 32 pruebas automáticas (`node --test supabase/tests/`). No se desplegaron automáticamente porque no hay entorno de prueba de Supabase accesible desde este entorno (la red de la sesión no alcanza `supabase.co`) y la ruta Apple Pay funciona hoy.

Orden recomendado:
1. Crear una rama de Supabase (`supabase branches create seguridad`) o un proyecto de prueba y desplegar allí.
2. `supabase functions deploy apple-pay-link apple-pay-shortcuts apple-pay-ingest --project-ref <REDACTADO>` (desde la raíz del repositorio).
3. Prueba manual: Atajo de iPhone con `dry_run:true` (debe devolver `ok`), una compra real, la misma compra repetida (`duplicate:true`).
4. Revisar logs de `function_edge_logs` (sin 5xx).
**Reversión:** redeployar `supabase/rollback/apple-pay-ingest.v12.ts` como `index.ts` de `apple-pay-ingest` (ingest). Para `apple-pay-link` y `apple-pay-shortcuts` las versiones previas (v8 y v4) siguen en el historial de versiones del panel de Supabase `[POR CONFIRMAR]`; el código original de v12 de ingest se conserva en el repo.

## Frontend
Rama `security/hardening-v183` → revisar → fusionar. Reversión: `git revert` del merge (CSP, biblioteca local y `src/early.js` son cambios aislados). Prueba: `node tests/csp.js && node tests/xss.js && node tests/smoke.js`.
