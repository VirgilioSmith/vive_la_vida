-- Limpieza de malas prácticas detectadas en la auditoría (advisors + inspección):
-- 1) Índices redundantes en apple_pay_* (cubiertos por otros índices o claves únicas).
-- 2) Políticas «ALL» sobre tablas que solo conceden SELECT: se sustituyen por SELECT (mismo efecto, intención explícita).
-- No cambia datos ni el comportamiento de la app: las escrituras siguen pasando por finance_apply_changes.

drop index if exists public.apple_pay_events_inbox_idx;            -- duplicado de apple_pay_events_user_status_date_idx (misma clave, sin DESC)
drop index if exists public.apple_pay_links_token_hash_unique;     -- duplicado de la restricción apple_pay_links_token_hash_key
drop index if exists public.apple_pay_links_user_idx;              -- cubierto por el índice único (user_id, instrument_type, instrument_id, currency)
drop index if exists public.apple_pay_links_user_active_idx;       -- sin uso; user_id ya es la primera columna del índice único

drop policy if exists finance_items_owner on public.finance_items;
create policy finance_items_select_own on public.finance_items for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists finance_values_owner on public.finance_values;
create policy finance_values_select_own on public.finance_values for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists finance_revision_owner on public.finance_revision;
create policy finance_revision_select_own on public.finance_revision for select to authenticated using ((select auth.uid()) = user_id);
