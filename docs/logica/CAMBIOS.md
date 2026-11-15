# Cambios a la lógica

| Fecha | Cambio | Motivo | Impacto |
|---|---|---|---|
| 2026-11-15 | Se agrega `lib/finanzas/reglas.js` (capa de cálculo puro y vigencias) | Centralizar fórmulas y poder probarlas | Ninguno en la app: todavía no se usa en pantalla |
| 2026-11-15 | Se agregan `tests/logica/` (10 pruebas unitarias y 256 comprobaciones de paridad con la app) | Verificar fórmulas, historial, consistencia e idempotencia | Ninguno |
| 2026-11-15 | `tests/harness.js` expone funciones internas solo para pruebas | Poder comparar la app con la capa pura | Solo pruebas |
| 2026-11-15 | Migración `20261115000000_reglas_vigentes_y_instantaneas` y su reversión | Guardar vigencias e instantáneas sin reescribir historial | Sin aplicar a producción; probada en una base local de pruebas |

No se modificó ninguna fórmula, función ni dato existente de la app.
