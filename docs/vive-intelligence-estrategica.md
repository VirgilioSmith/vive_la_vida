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

---

## Refinamiento (misma experiencia, más inteligencia interna)

Principio: **no se añadió ningún módulo, página ni navegación.** Los cambios son internos; en pantalla solo hay menos tecnicismos y, excepcionalmente, una pregunta de una línea dentro de un descubrimiento.

| Dimensión | Qué cambió | Estado |
|---|---|---|
| Curiosidad | Investiga sola; **ya no hay preguntas proactivas** (`curiosity.ask` es siempre `null`). Las lagunas se guardan como candidatas internas. | Implementado y probado |
| Creatividad | 5 interpretaciones nuevas con datos reales: *estabilidad creciente* (variabilidad semanal con intervalo por remuestreo), *mejora inadvertida* (variable baja, fijo e ingreso estables), *nueva normalidad* (gasto e ingreso suben en proporción → neutral, sin alarma) / *nivel más bajo sostenido*, *el aumento no viene de donde parecía* (descomposición por categoría), *comportamiento que desaparece*. Cada una tiene su control negativo (sin el patrón, no se emite). | Implementado y probado (sintético) |
| Predicción | Sin cambios visibles; el libro de predicciones y la abstención de la fase anterior siguen activos. Se añadió el contexto de **quincena** (días 14–16 y fin de mes) como explicación alternativa a los picos semanales. | Implementado; la estacionalidad anual sigue requiriendo ≥ 1 año |
| Estrategia | Se mantiene bajo demanda (futuros, laboratorio, consecuencias). No se convierte cada hallazgo en lista de tareas. | Sin cambios |
| Aprendizaje | Línea base incremental (`mem.base`): mediana semanal de gasto e ingreso y micropagos, una lectura cada ≥ 14 días (≤ 8), calculada desde el historial existente en la primera ejecución. Sin cuestionarios. | Implementado y probado |
| Autocrítica | **Control de repetición:** lo ya comunicado sin novedad material (< 15 % de cambio) se marca *repetido*: se conserva en la hoja pero baja su relevancia y no vuelve a anunciarse en la franja ni en el Centro Estratégico. Ya existían: refutación, consejo interno, desaprendizaje, calibración por falsos positivos. | Implementado y probado |
| Ciencia | Sin modelos nuevos «por aparentar». Los nuevos detectores usan intervalo por remuestreo, descomposición y controles. | — |
| Contexto | Quincena como alternativa; un aumento acompañado de ingreso no se trata como problema. Feriados, metas y prioridades: solo se usan si existen datos (la app no guarda metas ni bienestar). | Parcial |
| Preguntas | Una sola, ligada a un descubrimiento ambiguo (excepción→hábito, combinación atípica, tendencia lenta, aumento inesperado, categoría que desaparece), de ≤ 40 caracteres, con ≤ 2 opciones; visible ≤ 3 días y no se reasigna antes de 10 días. Ignorarla no cuenta como respuesta. | Implementado y probado |
| Silencio | Sin cupos diarios; lo repetido no genera ruido. | Implementado y probado |
| Sin carga técnica | Se retiró de la hoja: «Diagnóstico técnico», métricas de desempeño del modelo, voto del consejo interno, partes de la puntuación y fórmula. Las etiquetas de evidencia usan lenguaje llano («Distancia a lo habitual», «Posibilidad de que sea casualidad»…) y la metodología se explica sin nombres de algoritmos. Todo sigue disponible para mantenimiento en `window.__viveIntel.audit()` y en la exportación. | Implementado y probado |

### No implementado o experimental
- «Patrones dentro de patrones» y «diferencia entre percepción y registro»: no hay un método fiable con los datos actuales; solo existen aproximaciones (la prueba de explicaciones alternativas y la descomposición por categoría).
- Aprendizaje por prioridades declaradas: sin la pregunta proactiva, el consejo «humanista» se abstiene (no se infieren valores).
- Todo se validó con datos sintéticos y los de prueba de la app; no con datos reales ni en un iPhone.
- Recursos: sin consultas nuevas a Supabase; la memoria sigue < 8 KB y se escribe como máximo una vez al día. El análisis completo se cachea por revisión y día; abrir la hoja no lo recalcula.

Pruebas: `tests/intelligence-strategy.js` (70) y `tests/intelligence-strategy-ui.js` (23).

---

## Evolución maestra (alcance real: Dinero y Frases)

**Auditoría de alcance.** Solo se trabajó sobre las dos dimensiones implementadas. Se retiró de la hoja de Intelligence toda mención a módulos no autorizados (bienestar, garaje, metas, Vive Consciente). El banco de frases existente (780 entradas) no se tocó. No se añadieron tablas, funciones, migraciones, Realtime ni consultas a Supabase.

| Bloque | Capacidad | Estado |
|---|---|---|
| Dinero · Inversa (29) | Ingreso habitual que se retrasa / ausencia prolongada; cobro periódico de gasto (mismo concepto, monto e intervalo estables) que dejó de registrarse. Distingue retraso, cambio y falta de registro; nunca afirma causa. | Implementado y probado (sintético) |
| Dinero · Temporal / Señales (28, 33) | «Tu dinero se está adelantando a tu salario»: compromisos antes del próximo cobro esperado (por tu intervalo habitual) vs liquidez. | Implementado y probado |
| Dinero · Fusión / Señales débiles (20, 28) | Convergencia: ≥ 3 lecturas independientes de distinto tipo con la misma dirección (riesgo o mejora) generan una lectura conjunta. Las señales urgentes no cuentan como débiles. | Implementado y probado |
| Vigencia (18, 25) | Un patrón no observado 28 días pasa a *desactualizado* (se conserva la memoria histórica, no figura como vigente); si vuelve, *reaparecido*. | Implementado y probado |
| Percentiles (24) | Percentil personal en la evidencia de anomalías; banda descriptiva (muy por debajo … extraordinariamente por encima) sin juicio de valor. | Parcial: P5–P99 completos solo en anomalías; no hay bandas en otras lecturas |
| Calidad de datos (75–77) | Verificado en la app real: pagos de tarjeta, transferencias y avances de efectivo no cuentan como gasto/ingreso; devolución resta; USD se convierte con la tasa configurada; correcciones y eliminaciones se reflejan; pendientes no se interpretan como comportamiento. | Probado (10 comprobaciones) |
| Frases (61–67) | `phrases-intel.js` (pura, 2 KB): similitud por raíces + familias de conceptos (aproximación declarada, **no** embeddings). Rechaza una frase similar a las 12 últimas, idéntica a las 60 últimas, el mismo tema 3 veces y el mismo ritmo de longitud 3 veces. Memoria local de 60 frases. No usa datos financieros ni infiere emociones. | Implementado y probado en el banco real (150 frases consecutivas sin cuasi-repeticiones) |
| Frases · hallazgo | El banco real tiene **51 pares idénticos** repartidos entre temas distintos (p. ej. «¿Estás ahorrando para vivir o dejando de vivir para ahorrar?» en dos temas). La rotación ya los evita, pero conviene depurar el contenido; no se borró nada sin tu decisión. | Pendiente de tu decisión |
| Preguntas / Silencio / Autocrítica (56–59, 69, 79) | Ya cubiertos en el refinamiento anterior. | Sin cambios |

### No implementado
- Local Outlier Factor y agrupación de comportamientos: no hay evidencia en los datos actuales de que mejoren a Isolation Forest + z robusto; se descartan por «no aporta inteligencia real».
- Memoria de frases semántica con embeddings, y frases generadas: requerirían un modelo externo o de pago; no se usan.
- Champion–Challenger con efecto real: siguen faltando meses de historial (hoy 6).
- Evaluación de costos invisibles (intereses/comisiones acumulados) como hallazgo propio: la app registra intereses en el total mensual pero no por producto con fiabilidad suficiente; queda planificado.
- Modo silencioso de validación para capacidades nuevas: no se implementó; la superficie de comunicación ya filtra por silencio, evidencia y consejo interno.
- Todo se validó con datos sintéticos y de prueba, no con datos reales ni en iPhone.

### Rendimiento (medido)
`discover()` con 365 días y 9 motores + creatividad + inversa + convergencia: 12–18 ms en caliente (65 ms la primera vez), cálculo único por revisión y día. Sin consultas ni red.

Pruebas nuevas: `tests/intelligence-strategy.js` (87), `tests/intelligence-integridad.js` (10), `tests/frases-inteligencia.js` (15).
