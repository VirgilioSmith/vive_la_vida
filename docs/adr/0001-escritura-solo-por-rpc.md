# ADR 0001 · Escritura de datos financieros solo mediante RPC
**Contexto:** los usuarios autenticados podían escribir directamente en `finance_*` (incluido `TRUNCATE`), saltándose el control optimista de revisión.
**Decisión:** `SELECT` directo; toda escritura pasa por `finance_apply_changes` (`SECURITY DEFINER`, `search_path` vacío, identidad desde `auth.uid()`). `finance_write_item` queda interna.
**Consecuencias:** menor superficie y validación única. Cualquier ruta nueva de escritura debe hacerse por RPC. Reversión en `docs/security/`.
