-- Reversión de 20261115000000_reglas_vigentes_y_instantaneas.sql
-- ATENCIÓN: elimina las vigencias e instantáneas guardadas. Exporta antes si ya hay datos.
-- Los disparadores de solo-agregar se eliminan junto con sus tablas.
drop table if exists public.finance_record_snapshots;
drop table if exists public.finance_rule_versions;
drop function if exists public.finance_check_rule_start();
drop function if exists public.finance_block_history_changes();
