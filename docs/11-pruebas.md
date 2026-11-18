# 11 · Pruebas

## Existentes
| Prueba | Qué cubre | Evidencia |
|---|---|---|
| `tests/smoke.js` | Recorre 18 pantallas en escritorio y móvil; falla con errores de JS, textos `undefined/NaN` o desbordes | `tests/smoke.js` |
| `tests/harness.js` + `tests/mock.js` | Sirve los archivos y simula Supabase; gancho `window.__T` | `tests/harness.js` |

## Casos críticos y su cobertura
| Caso | Cobertura |
|---|---|
| Registro y guardado de un movimiento | Manual (scripts ad hoc), sin prueba versionada |
| Fórmulas de tarjeta (corte/total/pagos) | Verificadas con scripts ad hoc en sesiones de trabajo; **no** versionadas |
| Sincronización y conflictos | Sin pruebas |
| RLS (un usuario no ve a otro) | Sin pruebas |
| Edge Functions | Sin pruebas ni repositorio |
| Accesibilidad | axe-core ejecutado manualmente (no en CI) |

## Lo que falta
Pruebas unitarias de reglas financieras; pruebas de integración con una rama de Supabase; pruebas de RLS y de idempotencia de Apple Pay; CI en GitHub Actions; pruebas visuales.

## Actualización (remediación 03)
Hoy existen, además de las anteriores: pruebas de Edge Functions (`supabase/tests/*.test.mjs`, 32), prueba SQL de vigencias (`supabase/tests/reglas_vigentes.sql`, ejecutada en Postgres local), prueba SQL de `finance_apply_changes` (`supabase/tests/finance_apply_changes.sql`: revisión, idempotencia, atomicidad, aislamiento y límites), pruebas de navegador (`flujos-ingresos`, `adversarial`, `remediacion-03`, `rendimiento*`, `auditoria-*`) y análisis estático (`docs/auditoria/analisis-ast.js`). Siguen sin pruebas automáticas la reconciliación del cliente ante conflictos (necesita un Supabase simulado con revisiones) y la ejecución contra una rama real de Supabase.
