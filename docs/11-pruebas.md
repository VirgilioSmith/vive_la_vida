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
