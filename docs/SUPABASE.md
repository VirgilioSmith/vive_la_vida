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
