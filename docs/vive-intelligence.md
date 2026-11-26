# VIVE Intelligence · fase 1

Capa de inteligencia contextual **local**: observa, relaciona, anticipa, explica y recomienda.
**No ejecuta** pagos, transferencias, compras, cancelaciones ni operaciones financieras. No incluye Autopilot, Discovery ni Replay.

## 1 · Auditoría previa (hallazgos reales)

| Tema | Hallazgo |
|---|---|
| Arquitectura | SPA de un solo IIFE (`src/app.js`), registro de páginas `pages={…}`, navegación por `data-act="navigate"`/`ui.page` + `render()`. |
| Fuentes de datos | `db` en memoria (cuentas, tarjetas, préstamos, movimientos, recurrentes, certificados, entre personas, presupuesto). Sin metas, garaje ni datos de bienestar guardados. |
| Indicadores existentes (reutilizados) | `monthlyTotals` (ya separa transferencias, pagos de tarjeta, devoluciones y amortización), `cardStatus`, `loanStatus`, `upcoming`, `v89DebtCapacity`, `v290BudgetSnapshot`, `historicalPosition`, `totalLiquid/CardDebt/LoanDebt/Certificates`, `personalTotals`, `v339ActiveRecurring`. |
| Caché existente | `v99Memo` con invalidación por `v99Invalidate()` (se llama en persist, ediciones y cargas). Intelligence se **engancha ahí**: no crea otro mecanismo. |
| Centro Estratégico / Momentos | `vMomentosSnapshot` produce momentos a partir de vencimientos y presión. Intelligence no lo duplica; comparte las mismas funciones fuente. |
| VIVE Consciente | Existe solo como contenido de reflexión; no guarda datos del usuario. Por eso el motor *Life* es opt-in y solo usa categorías de gasto. |
| Supabase | Escritura vía `persist()` → RPC `finance_apply_changes`. Realtime ya existente. Intelligence **no consulta ni se suscribe**. |
| Rendimiento | Riesgo histórico: tormentas de reintentos de guardado. Intelligence solo escribe cuando el usuario pulsa una opción de retroalimentación (≤ 1 escritura por acción). |

## 2 · Arquitectura

```
app.js  (puente de SOLO LECTURA)
  vIntelSnapshot()  → snapshot normalizado (RD$ equivalente, con origen)
  vIntelRun()       → caché por (revisión, fecha, aprendizaje); invalidada por v99Invalidate
  window.__viveIntel = {run, feedback, setPref, snapshot, invalidate, go, …}
        │  carga bajo demanda (idle) la primera vez que se muestra un módulo con Intelligence
        ▼
src/intelligence/engine.js   motor puro (sin DOM/red/temporizadores) → window.ViveIntelligence
src/intelligence/ui.js       franja contextual + hoja de hallazgos (sin nueva opción de navegación)
src/intelligence/intelligence.css   identidad visual (Liquid Glass, Claro/Black, acento dinámico)
```

### Los 12 motores
| Motor | Responsabilidad |
|---|---|
| Context | Normaliza el snapshot y mide la suficiencia de datos (meses completos, ingresos, tasa). |
| Financial | Flujos: ingresos, gastos, ahorro, comparaciones **solo entre meses completos**. |
| Pattern | Suscripciones, atípicos, gastos repetidos no registrados, devoluciones, calendario. |
| Prediction | Proyecciones (siempre `kind: projection`): cierre de mes, presupuesto, cargas futuras. |
| Risk | Vencidos, liquidez vs 30 días, compromisos, saldos negativos, patrimonio, exposición en US$. |
| Opportunity | Reserva, excedentes, certificados por vencer, cobros pendientes. |
| Credit | Utilización, mínimos, avances, carga de cuotas, abonos extra. |
| Life | **Opt-in**. Solo cifras registradas; no infiere emociones ni salud. |
| Decision | Relaciona hallazgos y elimina recomendaciones contradictorias. |
| Learning | Pondera relevancia con la retroalimentación sin ocultar lo esencial. |
| Narrative | Redacta explicaciones humanas y el «¿por qué lo veo?». |
| Priority | Clasifica, deduplica, expira y limita saturación. |

### Capacidades (64 reglas, extensibles con `rule(id, engine, run)`)
Contexto 5 · Financiero 16 · Riesgo 14 · Crédito 9 · Oportunidad 5 · Patrones 8 · Predicción 5 · Vida 2.
Lista completa: `ViveIntelligence.rules`.

### Esquema de hallazgo
`id, key, rule, engine, category, priority, kind (fact|projection|interpretation), evidence[{label,value,source}], period, generatedAt, expiresAt, confidence (0–1), title, explanation, action{label,target}, modules[], essential, urgency, magnitude, fingerprint`.

### Prioridades
Crítico · Requiere atención · Oportunidad · Informativo · Reconocimiento. Máx. 12 visibles, 1 reconocimiento, 2 informativos por motor. Obligaciones (`essential`) nunca quedan bajo contenido motivacional (orden por clase) y no se silencian con «No me interesa».

### Aprendizaje controlado
«Me resulta útil» · «No me interesa» · «Ya lo resolví» (se reevalúa si cambia la huella de la situación) · «Mostrar menos» · «¿Por qué estoy viendo esto?». Estado compacto en `db.settings.intelligence` (<2 KB), una escritura por acción. Lo esencial solo reduce énfasis, nunca desaparece.

## 3 · Normalización financiera
Se reutiliza `monthlyTotals`, que ya: separa monedas (US$ × tasa del movimiento), excluye transferencias propias, no cuenta el pago de tarjeta como gasto (el gasto es la compra), resta devoluciones, y excluye el capital amortizado de préstamos (solo intereses/cargos son gasto). La prueba `tests/intelligence.js` lo verifica con un escenario con todos esos casos (resultado esperado 34.000). Nada se inventa: si falta evidencia, la regla no emite.

## 4 · Integración
Franja delgada en Inicio, Movimientos (también Egresos/Categorías), Bancos, Cuentas, Tarjetas/Wallet, Préstamos, Patrimonio (y Certificados), Suscripciones, Compromisos, Ingresos, Presupuesto, Entre personas y Explorar. Las acciones usan el sistema real de navegación. Sin nueva opción de menú.

## 5 · Rendimiento (medido)
| Medida | Resultado |
|---|---|
| Peticiones a Supabase por Intelligence | **0** (verificado) |
| Primer análisis (64 reglas, datos de prueba) | ≈ 3–4 ms |
| Re-cálculo completo tras invalidación | ≈ 3 ms |
| Montar la franja con caché | ≈ 0,06 ms (sin lecturas de layout) |
| Peso (carga bajo demanda, en reposo) | engine.js ≈ 61 KB · ui.js ≈ 10 KB · css ≈ 12 KB (sin comprimir) |
| Polling / Realtime / tareas en segundo plano | Ninguno |

## 6 · Pruebas
* `node tests/intelligence-unit.js` — 53 verificaciones (esquema, ≥50 reglas, sin datos, historial corto, periodos parciales, multimoneda, crédito, riesgo, contradicciones, aprendizaje, saturación, lenguaje, pureza, rendimiento).
* `node tests/intelligence.js` — 58 verificaciones Playwright (normalización real, móvil y PC, hoja, navegación, aprendizaje, red, caché, temas y acentos).

## 7 · Limitaciones
* **Metas, Mi garaje y bienestar**: la app no guarda esos datos; no hay reglas sobre ellos (no se inventan). VIVE Consciente es contenido de reflexión.
* VIVE Score tiene su propio host aislado: la franja no se monta dentro de él en esta fase.
* La detección de gastos repetidos usa la nota/beneficiario; movimientos sin texto no se agrupan.
* Las proyecciones son lineales y se etiquetan como tales.
* No se creó ninguna tabla ni función de Supabase: el aprendizaje reutiliza `db.settings` y su persistencia existente.

## 8 · Riesgos
* `settings.intelligence` crece con el uso: se poda por caducidad (≤ 60 días) y se acota a <2 KB en la prueba.
* Datos antiguos de producto (p. ej. tarjetas con corte muy viejo) generan «vencidos» legítimos pero llamativos; son los mismos que muestra Presión financiera.
* La calidad de los hallazgos depende de la calidad del registro (categorías, notas).
