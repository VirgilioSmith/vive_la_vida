# Supabase: tablas y reglas de seguridad esperadas

La app usa la clave **publicable** en el navegador; toda la seguridad depende de Row Level Security (RLS).
Todas las consultas filtran por `user_id` (id del usuario autenticado). Verifica en el panel de Supabase
(Authentication → Policies) que cada tabla tenga RLS activado y políticas equivalentes a estas:

| Tabla | Columnas que usa la app | Política recomendada |
|---|---|---|
| `finanzas_estado` | `user_id`, `documento` (JSON), `actualizado_en` | `select/insert/update` solo si `user_id = auth.uid()` |
| `finance_revision` | `user_id`, `revision` | `select` solo si `user_id = auth.uid()`; escritura solo vía la función `finance_apply_changes` |
| `apple_pay_links` | `id, user_id, instrument_type, instrument_id, card_label, currency, active, created_at` | `select/delete` solo si `user_id = auth.uid()`; alta/edición vía función edge |
| `apple_pay_events` | `id, user_id, event_id, link_id, instrument_id, amount, merchant, currency, received_at, transaction_time, status, local_tx_id` | `select/update/delete` solo si `user_id = auth.uid()`; inserción solo desde la función edge con clave de servicio |

Ejemplo de política (SQL):

```sql
alter table public.finanzas_estado enable row level security;
create policy "propio_select" on public.finanzas_estado for select using (user_id = auth.uid());
create policy "propio_insert" on public.finanzas_estado for insert with check (user_id = auth.uid());
create policy "propio_update" on public.finanzas_estado for update using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Función RPC usada: `finance_apply_changes(p_expected_revision, …)` — debe validar `auth.uid()` internamente
y rechazar revisiones desactualizadas. Funciones edge usadas y **no incluidas** en este repositorio:
`apple-pay-link`, `apple-pay-shortcuts`.

Este documento describe lo que la app espera; no sustituye la verificación en tu proyecto.


## Estado real verificado (14 nov 2026) y consumo de recursos
Verificado directamente en el proyecto `vive-el-hoy-finanzas-360`:
- Todas las tablas tienen RLS activo. Base de datos: 24 MB. El modelo vigente es relacional (`finance_items`, `finance_values`, `finance_revision`) más `apple_pay_*`; las 18 tablas heredadas (`bancos`, `cuentas`, …) están vacías.
- `finanzas_estado` **ya no existe** en el servidor (el código solo la menciona en rutas heredadas).
- Tráfico de 24 h antes de la optimización: 1.290 lecturas de `finance_values` (≈117 recargas completas de ~10.000 filas), 1.372 de `apple_pay_events`, 713 de `finance_revision`, 312 conexiones realtime.

### Optimización V1043
- Tabla `finance_collection_state(user_id, collection, revision)`: `finance_apply_changes` registra en qué revisión cambió cada colección. El cliente compara y **solo descarga las colecciones que cambiaron**; si hay cualquier duda cae a la lectura completa.
- Con la pestaña oculta no se descarga nada; al volver a verse se verifica la revisión.
- El sondeo de Apple Pay baja de cada 3 min a cada 10 min (los eventos nuevos siguen llegando por realtime al instante).
- Pendiente en el panel de Supabase (no se puede cambiar por SQL): activar *Leaked password protection* en Authentication.


### Limpieza y Apple Pay (V1044)
- Se eliminaron las 19 tablas heredadas (todas con 0 filas, sin referencias en la app, funciones edge, vistas, disparadores ni cron): `bancos, cuentas, tarjetas, prestamos, movimientos, suscripciones, estados_cuenta, presupuestos, certificados, beneficios, prestamos_personales, categorias, revisiones_movimientos, operaciones_pendientes, previsiones, conciliaciones, documentos, auditoria, tasas_cambio`.
- Apple Pay no se tocó. Flujo: el atajo del iPhone hace POST a `apple-pay-ingest` (token `vhap_…`, idempotente por `event_id`) → inserta en `apple_pay_events` → Realtime avisa a la app al instante → la app importa. El sondeo queda solo como red de seguridad: cada 30 min con Realtime conectado, cada 3 min si no lo está.
- Los índices de `apple_pay_*` aparecen como «sin uso» porque las tablas tienen pocas filas; se conservan para cuando crezcan.

## Antigüedad de productos
Cuentas bancarias, tarjetas, préstamos y certificados guardan `acquiredOn` (AAAA-MM-DD, opcional, no futura) dentro del mismo documento de cada producto. No requiere cambios de esquema: los datos viajan por `finance_items` y `finance_values` como cualquier otro campo. El efectivo no tiene antigüedad. Préstamos y certificados usan su fecha de inicio si no se indica.
