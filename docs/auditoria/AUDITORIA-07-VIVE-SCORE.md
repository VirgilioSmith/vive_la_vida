# Auditoría 07 · Vive el Score (dictamen del comité)

Estado: **investigación y pruebas ejecutadas; no se modificó ningún cálculo.** Todo cambio propuesto en la sección IV–V espera confirmación. Los perfiles del comité (estabilidad financiera, riesgo crediticio, riesgos bancarios, auditoría financiera, auditoría de modelos, analítica) son perfiles de exigencia técnica, no afiliaciones ni certificaciones. Vive el Score **no es** un score de buró ni una probabilidad de impago.

Evidencia reproducible: `docs/auditoria/herramientas-codigo/score-adversarial.js` y `score-integridad-app.js` (Playwright sobre la app real; los casos usan **datos de demostración** y mutaciones sintéticas del motor: prueban el comportamiento del algoritmo, no la situación financiera de ninguna persona).

## I. Diagnóstico actual
**Qué es.** Un índice determinista de 0 a 1000 («VIVE SCORE CRÉDITO v5.0.0») que suma 5 factores y 15 subreglas, calculado en `src/vive-score/score.js` (`evaluateRaw`) a partir de una fotografía mensual armada por `state.js` con datos que lee `adapter.js` (solo lectura) desde la app.

| Factor | Máx. | Subreglas (puntos) |
|---|---|---|
| Historial de pagos (35 %) | 350 | puntualidad reciente 235, antecedentes/cobranza 80, atraso vigente 35 |
| Deuda y utilización (30 %) | 300 | uso agregado 180, tarjeta más usada 45, tensionadas/sobrelímite 25, avance de préstamos 35, avances de efectivo 15 |
| Antigüedad y profundidad (15 %) | 150 | cuenta más antigua 75, antigüedad promedio 45, evidencia 30 |
| Crédito reciente (10 %) | 100 | aperturas 60, aumentos de límite solicitados 40 |
| Composición (10 %) | 100 | gestión de productos 65, combinación 35 |

**De dónde viene cada dato.** Tarjetas y préstamos reales (saldo, límite, mínimo, mora derivada de vencimientos no pagados, antigüedad); atrasos y aperturas **declarados** en un cuestionario; cortes mensuales guardados en el navegador. Ingresos, gastos fijos y liquidez alimentan solo el módulo de **capacidad**, no el score (decisión de diseño documentada).
**Escala y pesos.** Los pesos 35/30/15/10/10 provienen de una guía educativa (ProUsuario) citada en el propio módulo; los puntos de cada subregla y las curvas (p. ej. 12 % → 177, 29 % → 148) son **reglas propias** sin calibración estadística. La app lo declara en pantalla.
**Determinismo.** Misma entrada → mismo resultado (2/2 comprobaciones iguales).

## II. Hallazgos de auditoría
Gravedad: **A** alta (puede producir una conclusión engañosa), **M** media, **B** baja.

| ID | Hallazgo | Evidencia ejecutada | Gravedad |
|---|---|---|---|
| H1 | **La mora vigente casi no cuesta puntos.** Una tarjeta con 672 días de atraso resta como máximo 35 puntos (de 1000); la severidad real solo entra cuando el mes se cierra y se vuelve «antecedente». | Barrido de atraso 0→672 d: 866 → 858 (1 d) → 844 (30 d) → 838 (60 d) → **831 (90 d y todos los mayores)**. Una sola mora de 60 días *declarada* en el cuestionario: **766** (−100). El mismo atraso, según cómo se registre, vale 100 o 35 puntos. | **A** |
| H2 | **Expediente delgado = puntaje alto.** Con 1 mes de evidencia y una sola tarjeta nueva sin incidentes el índice da «Perfil sólido». El factor de antigüedad (15 %) solo descuenta ~150 puntos; los demás factores premian la *ausencia* de datos negativos. | Tarjeta nueva, 1 mes de historia, 5 % de uso, 1 apertura reciente: **821** (frente a 831 del perfil de demo con 57 meses). Tarjeta sin saldo y sin historia: 822. Evidencia 1 mes vs 24 meses: 831 vs 860 (solo 29 puntos de diferencia). | **A** |
| H3 | **Valores «neutros» inflan.** Sin tarjetas (solo un préstamo) el uso agregado recibe 135/180 y 35, 25 y 15 en las demás subreglas de tarjetas sin evidencia alguna. Composición da 65 puntos fijos por «tener producto activo» y 28–35 por tener tipo(s), sea cual sea el comportamiento. | Solo préstamo, sin tarjetas: **803**. Composición = 93/100 con cualquier producto activo. | **M** |
| H4 | **Se mide el saldo del momento, no el del corte.** Pagar la tarjeta antes de leer el índice mejora la utilización al instante; los burós usan el saldo reportado en la fecha de corte. Es una mejora real de la deuda, pero también manipulable por calendario. | Uso 50 % → 0 % (pago total): **787 → 872** (+85). | **M** |
| H5 | **Sin detección de movimientos duplicados.** Una compra de tarjeta duplicada se suma a la deuda y por tanto al uso; la validación solo detecta tarjetas/créditos duplicados, no operaciones. | Compra duplicada de RD$10,000: deuda 39,400 → 49,400. | **M** |
| H6 | **La mora se deriva de «vencimientos sin pagar» de la app**, no de un reporte bancario. Un vencimiento sin conciliar parece mora. La app ya advierte, pero el score la usa como dato. | En la demo, 4 líneas con 650–672 días «de atraso» salen de fechas de vencimiento viejas sin pago registrado. | **M** |
| H7 | **Pesos y curvas sin validación empírica** (no hay datos de incumplimiento propios). El módulo lo reconoce, pero la tarjeta principal muestra un número sin intervalo ni nivel de confianza. | `recordMonths=1` → confianza de datos 60/100 en otra pantalla; el anillo no lo refleja. | **M** |
| H8 | Cambios de tipo de cambio apenas afectan (utilización agregada ponderada): comportamiento coherente. | TC 40/60/80 → 830/831/831. | Sin hallazgo |
| H9 | Ingresos, liquidez y gastos **no** mueven el score (por diseño). | Ingreso 0 / RD$5 M, liquidez RD$100 M, gasto RD$900 K: **831** en los cuatro. | Conforme con el diseño; ver IV |
| H10 | Transferencias entre cuentas propias no alteran tarjetas ni préstamos leídos por el adaptador. Un pago de tarjeta baja la deuda de forma correcta (49,400 → 29,400). | Prueba en la app con datos de demostración. | Conforme |
| H11 | Monotonía: más uso → menos puntos en toda la curva (0 %→120 %: 872 → 629); más moras declaradas → menos puntos (866, 791, 716, 641); más antigüedad → más puntos (778 → 928). | Barridos ejecutados. | Conforme |
| H12 | Un préstamo nuevo baja el índice de inmediato (−7 con 0 % amortizado frente a «sin préstamos») y sube conforme se amortiza (829 → 841 → 851). | Barrido ejecutado. | Conforme (comportamiento razonable) |

## III. Dictamen metodológico
- **Transparente y reproducible: sí.** Cada subregla trae su fórmula, su explicación y su valor; es determinista.
- **Fundamentado: parcialmente.** Los pesos siguen una categorización educativa conocida; las curvas y topes son juicio del autor, sin calibración.
- **Confiable para decidir: no todavía.** Con H1 y H2 el índice puede decir «sólido» a un perfil con una mora grave vigente o con un solo mes de datos. Eso es una **desviación de la propia intención declarada** del módulo («sin acelerar artificialmente el tiempo», «cada punto tiene una razón»).
- **Dimensiones del comité.** Del conjunto pedido (solvencia, liquidez, endeudamiento, capacidad de pago, utilización, estabilidad, disciplina, resiliencia, evolución), el score usa **utilización, disciplina (pagos), evolución parcial (cortes) y antigüedad**. Capacidad de pago, endeudamiento sobre ingresos, liquidez y resiliencia viven en el módulo de capacidad, fuera del score. Es una separación defendible (los burós tampoco usan ingresos), pero hoy el usuario ve dos mundos sin una lectura integrada. Solvencia (patrimonio neto) no se usa en ningún lugar de este módulo.
- Etiqueta correcta de producto: **índice de comportamiento crediticio basado en reglas**, no calificación ni probabilidad de incumplimiento.

## IV. Modelo propuesto (a confirmar)
Principio: **no cambiar a ciegas.** Corregir lo que contradice la intención declarada y añadir lo que falta como una **lectura separada**, sin mezclar peso arbitrario.

**Correcciones al índice existente (alto impacto, bajo riesgo de diseño)**
1. **Severidad de la mora vigente (H1).** Hacer que el atraso vigente use la misma escala que el atraso declarado: puntos a restar = penalización de la categoría (<30 d: 18; 30–59: 75; 60–89: 100; 90–119: 135; 120+: 165), tomando el peor producto, sin duplicar con el histórico del mismo evento (al cerrar el mes la mora pasa de «vigente» a «histórica» y se sustituye, no se suma). Fundamento: coherencia interna con la tabla ya aprobada de antecedentes.
2. **Amortiguador de expediente delgado (H2/H7).** Un factor de confianza `c = min(1, meses de evidencia / 12)` que **no** cambia el puntaje, sino que se muestra junto a él («831 · confianza 8 %»), y un tope visible de «Perfil en desarrollo» mientras `c < 0,5` o la antigüedad promedio sea menor a 12 meses. Fundamento: no inventar una probabilidad; declarar el límite de la evidencia.
3. **Neutros explícitos (H3).** Cuando una subregla no tenga evidencia, mostrarla como «sin evidencia» con **puntaje fijo en el nivel medio del rango** y marcar el factor como «incompleto», en vez de acercarlo al máximo. Composición: reducir el puntaje fijo por «tener producto» y condicionarlo a meses de gestión.
4. **Saldo al corte (H4).** Usar el saldo facturado al último corte para la utilización agregada cuando exista; mostrar el saldo actual solo como informativo.
5. **Duplicados (H5).** Alerta (no corrección automática) cuando existan dos operaciones con misma tarjeta, importe, fecha y comercio.
6. **Mora conciliada (H6).** Mostrar si el atraso proviene de vencimientos sin conciliar y pedir confirmación antes de contarlo como mora vigente.

**Lectura separada nueva: «Salud financiera» (diagnóstico personal, no puntaje crediticio)** — índice transparente por reglas, sin pretender ser predictivo:

| Dimensión | Cálculo | Fuente | Por qué |
|---|---|---|---|
| Endeudamiento | cuotas mensuales / ingreso reconocido (DTI) | ya existe en capacidad | mide sostenibilidad de la deuda |
| Liquidez | meses de obligaciones cubiertos con dinero ≥ 30 días (`held30 / obligaciones`) | ya existe | respuesta de corto plazo |
| Resiliencia | margen mensual bajo el estrés ya definido (ingreso −20 % formal/−50 % informal, USD +10 %, tasa +2 pp) | ya existe | capacidad ante shocks |
| Solvencia | patrimonio neto / activos | Patrimonio | respaldo patrimonial |
| Estabilidad | variación del neto mensual en 6 meses | Movimientos | consistencia de flujos |

Cada dimensión se presenta con su valor, su umbral y su explicación; **no se suman en un número hasta tener criterio validado**. Los umbrales de partida (DTI 35 %, cobertura de liquidez 3 meses) son los que el módulo de capacidad ya usa y se declaran como parámetros de planificación, no como estándares. No se proponen pesos: sin datos de resultados, cualquier peso sería arbitrario.

**Validación.** (a) Batería de pruebas de propiedades (monotonía, idempotencia, invariancia ante transferencias propias y pagos), ya iniciada en `score-adversarial.js`; (b) casos dorados por perfil con resultado esperado documentado antes de calcular; (c) para el índice actual no hay muestra de incumplimiento, por lo que **no se puede validar predictivamente**: se declara.

## V. Plan de implementación (propuesto; requiere tu confirmación)
| Prioridad | Cambio | Dependencias | Riesgo |
|---|---|---|---|
| P1 | Severidad de mora vigente (IV.1) | pruebas de regresión del motor (hoy 39) | puede bajar puntajes existentes: se comunica |
| P1 | Confianza y tope «en desarrollo» (IV.2) | solo presentación + una regla de etiqueta | bajo |
| P2 | Neutros explícitos y composición (IV.3) | rediseño de dos subreglas | medio (cambia el puntaje de perfiles delgados) |
| P2 | Saldo al corte (IV.4) | `cardStatus.billed` ya disponible | medio |
| P3 | Alerta de duplicados (IV.5) y mora conciliada (IV.6) | adaptador | bajo |
| P3 | Lectura «Salud financiera» (IV, tabla) | datos ya calculados en capacidad | bajo, aditivo |

Ninguna de estas acciones elimina funciones: son correcciones, etiquetas y una lectura nueva aditiva.

## VI. Resultado de la validación (ejecutado)
| Prueba | Resultado |
|---|---|
| Determinismo (misma entrada, mismo resultado) | Pasa (2/2) |
| Escala y suma de pesos | 1000 = 350+300+150+100+100; máximos de subreglas coinciden con los pesos |
| Monotonía en utilización, moras declaradas, antigüedad | Pasa |
| Ingresos / liquidez / gastos no alteran el score | Pasa (por diseño) |
| Transferencias propias no alteran tarjetas ni préstamos | Pasa |
| Pago de tarjeta reduce la deuda correctamente | Pasa |
| Variación por tipo de cambio | Pasa (cambio mínimo) |
| Severidad de mora vigente | **Falla**: se satura en 35 puntos (H1) |
| Expediente delgado no debe parecer «sólido» | **Falla** (H2) |
| Valores neutros no deben beneficiar | **Falla parcial** (H3) |
| Duplicados detectados | **No cubierto** (H5) |
| Pruebas existentes del módulo | 39/39 pasan (`tests/vive-score.js`) |

**Limitaciones.** Los casos usan datos de demostración y mutaciones del motor; no hay datos reales de incumplimiento, por eso no se evaluó capacidad predictiva ni se calibraron pesos. No se probó el flujo completo de importación de datos con cuentas reales. No se ejecutó revisión de seguridad del almacenamiento (el módulo guarda en el navegador, sin red). La revisión «independiente» entre perfiles es una revisión cruzada interna de un solo ejecutor, no una auditoría externa.

**Desacuerdos y riesgos residuales del comité.** (1) Riesgos propone penalizar la mora vigente sin atenuación; el modelador advierte que sin conciliación puede castigarse un pago olvidado en la app → se resuelve con IV.6. (2) Estabilidad financiera pide integrar capacidad y score en una sola cifra; el auditor de modelos lo rechaza por falta de validación → se resuelve con lectura separada. Riesgo residual: cualquier recalibración sigue siendo juicio de reglas, no estadística.

## VII. Experiencia financiera final (propuesta)
Una sola vista, ejecutiva, web y móvil: (1) el índice con su **confianza** al lado y la etiqueta correcta («índice de comportamiento crediticio, no un score de buró»); (2) tres frases: fortaleza principal, vulnerabilidad principal y qué cambió respecto al mes anterior, cada una enlazada a su subregla; (3) «Salud financiera» con las cinco dimensiones como lecturas, sin sumar; (4) «Qué falta» (antecedentes, meses de evidencia, vencimientos sin conciliar) y (5) una sola acción sugerida por vulnerabilidad, concreta y calculada con los datos del usuario. Sin alarmismo, sin indicadores decorativos.

## Decisión que necesito
¿Autorizas el plan **P1** (IV.1 y IV.2)? Cambia el puntaje de perfiles con mora vigente o poco historial, así que quiero tu confirmación antes de tocar el motor. Las prioridades P2 y P3 las propondría después con casos dorados.
