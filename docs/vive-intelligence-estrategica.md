# VIVE Intelligence · capa estratégica

Pregunta rectora: **¿qué está ocurriendo en la vida financiera del usuario que todavía no ha identificado?**
Todo es local, determinista (semilla fija) y sin servicios externos. No hay IA generativa. Vive no ejecuta pagos, transferencias ni cambios.
Archivo: `src/intelligence/strategy.js` (se carga bajo demanda junto con `discovery.js`). Pruebas: `tests/intelligence-strategy.js` (50, Node) y `tests/intelligence-strategy-ui.js` (17, app real, móvil y PC).

## Matriz de estado

| Capacidad | Estado | Cómo funciona / límite |
|---|---|---|
| Primeros principios (`lifeModel`) | **Implementado y probado** | Descompone la liquidez en comprometido (vencido + 30 d), seguridad (3 meses de gasto, supuesto visible), vida (1 mes) y libre. La suma cuadra con la liquidez visible. No incluye ingresos futuros ni valores no líquidos. |
| Consecuencias de 1.º–4.º orden (`chain`) | **Implementado y probado** | 1.º cuota; 2.º compromisos y meses de reserva; 3.º/4.º disponibilidad a 90/365 d con y sin la decisión (Monte Carlo). Siempre recuerda que endeudarse no es malo por sí mismo: los beneficios que no se pueden medir los pone el usuario. |
| Futuros alternativos (`horizon`) | **Implementado y probado** | 5 futuros × 7 horizontes (7–365 d), bootstrap por bloques de 7 días, p10/p50/p90 y proporción de trayectorias negativas. Son escenarios con supuestos declarados, **no** probabilidades calibradas. Se niega con < 60 días. |
| Laboratorio de decisiones (`decisionLab`) | **Implementado y probado** | 5 alternativas (conservadora, equilibrada, estratégica, oportunidad, no intervenir) con beneficios, costos, incertidumbre, reversibilidad, flexibilidad e impacto a 365 d. No ejecuta nada. |
| Grafo de conocimiento (`graph`) | **Implementado (derivado, no persistido)** | ≤ 40 nodos y ≤ 80 aristas con evidencia, incertidumbre y vigencia; vecinos y caminos. Las coincidencias entre variables se marcan «por validar» (no causalidad). |
| Curiosidad (`curiosity`) | **Implementado y probado** | Separa lo conocido de lo desconocido y hace **como máximo una** pregunta con valor de información, explicando por qué y qué cambiará. Las respuestas se guardan en `mem.declared`/`mem.qa`. No infiere condiciones médicas ni psicológicas. |
| Científico (`science`) | **Implementado, cubre 5 tipos de hallazgo** | Intenta refutar: quitar el 5 % superior, dividir por mitades temporales, excluir días de cobro, revertir. Hallazgo refutado → no se comunica. Otros tipos: «no aplica». Estacionalidad anual: solo si hay ≥ 60 semanas; si no, queda declarada como reserva. |
| Consejo interno (`council`) | **Implementado como validaciones deterministas** | Ocho perspectivas (investigador, escéptico, estratega, predictor, optimizador, protector, humanista, sintetizador) con voto y disenso visibles. No son agentes ni modelos generativos. El humanista solo opina si el usuario declaró prioridades. |
| Sombra (`shadow`, 9.º motor) | **Implementado y probado** | Combinación atípica multivariable (Isolation Forest, sin indicador extremo por separado), tendencia lenta (Mann–Kendall + Theil–Sen), excepción→hábito, paradojas (ingreso↑/gasto fijo↑; gasto variable↓/fijo↑), coincidencia temporal de vencimientos, ingreso anómalo como oportunidad, efecto mariposa con sensibilidad ±20 %. |
| Paradoja patrimonio↑/liquidez↓ | **Planificado** | La serie histórica del snapshot solo trae patrimonio neto, no liquidez; la regla queda inactiva hasta que haya serie de liquidez. |
| Metacognición | **Implementado, madura con el tiempo** | Libro de predicciones de gasto mensual (≤ 14) que se evalúan al cerrar el mes (error absoluto, cobertura del intervalo del 90 %, comparación con el modelo ingenuo). Si el intervalo acierta < 50 % o rinde peor que el ingenuo, **Vive se abstiene** y lo dice. Hoy la app guarda 6 meses completos: se puede evaluar, pero aún no promover. |
| Champion–Challenger | **Implementado y probado con series sintéticas; sin efecto en producción hasta tener ≥ 8 meses** | 5 candidatos simples; el retador solo reemplaza si mejora ≥ 10 % en ≥ 5 puntos de backtest y no empeora los últimos 3; versión e historial; rollback si el campeón rinde > 10 % peor que el ingenuo. No toca código, permisos ni objetivos. |
| Calibración por retroalimentación | **Implementado** | Si ≥ 5 respuestas y > 40 % marcan «incorrecto», el umbral de confianza de ese motor sube 0,10. |
| Desaprendizaje | **Implementado** | Un patrón confirmado que no se observa en 28 días se retira para revisión. |
| Benchmark | **Implementado, sin puntuación global** | Se reporta cada medida por separado; `null` = aún sin datos. |
| Anticipación débil/emergente/persistente/confirmada | **Parcial** | Se usa el ciclo de vida existente (hipótesis → aprendizaje → descubrimiento/riesgo); no hay etiquetas nuevas en la interfaz. |
| Valores del usuario | **Parcial** | Solo prioridades declaradas por pregunta explícita; se usan en el consejo interno. No optimiza solo dinero, pero tampoco calcula «calidad de vida». |
| Bienestar, garaje, metas | **No hay datos** | La app no los guarda; no se infiere nada. |

## Prueba definitiva (11 escenarios, `tests/intelligence-strategy.js`)
1 combinación atípica sin indicador extremo · 2 ahorro variable que oculta aumento fijo · 3 anomalía = oportunidad · 4 cambio lento (con control sin deriva) · 5 coincidencia azarosa (6 semillas, 0 correlaciones espurias) · 6 predicción anterior incorrecta → abstención · 7 excepción→hábito · 8 usuario corrige → umbral sube · 9 sin información suficiente → se niega a afirmar · 10 modelo complejo no gana a uno simple en ruido, sí en tendencia, con rollback · 11 vencimientos que coinciden (cuándo, no cuánto).

Limitaciones honestas: se probó con datos sintéticos y los de prueba de la app, no con datos reales del usuario ni en un iPhone; el escenario 1 solo comprueba que no hay falsa alarma (no garantiza detectar todo caso); el detector de tendencia lenta es conservador (requiere ≥ 20 semanas y p ≤ 0,05).

## Recursos
Cálculo ≈ 40–70 ms por evaluación (presupuesto 150 ms), futuros/decisiones solo bajo demanda. Sin consultas nuevas a Supabase, sin tablas ni funciones nuevas; la memoria sigue en `settings.intelligenceMem` (< 8 KB, ≤ 1 escritura al día). No se añadieron módulos ni navegación: todo vive en la hoja «Lo que Vive sabe de ti».
