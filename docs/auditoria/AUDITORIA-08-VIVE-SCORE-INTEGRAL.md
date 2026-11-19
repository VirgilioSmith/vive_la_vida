# Auditoría 08 · Vive el Score · auditoría integral y excelencia crediticia

Continuación de `AUDITORIA-07-VIVE-SCORE.md`. Estado: **auditoría ejecutada, un cambio aditivo implementado (alerta de duplicados), pruebas de propiedades añadidas; los cambios estructurales esperan tu autorización.** Los perfiles profesionales del encargo son perfiles de exigencia, no afiliaciones ni certificaciones. Vive el Score es un **índice propio de comportamiento crediticio basado en reglas**: no es un score de TransUnion, Equifax ni FICO, ni una probabilidad de incumplimiento.

## 1. Metodología encontrada (fuente de cálculo)
| Pieza | Archivo | Función |
|---|---|---|
| Lectura de datos (solo lectura) | `src/vive-score/adapter.js` | convierte tarjetas, préstamos, atrasos, ingresos y gastos en una «carga» |
| Fotografía mensual y contadores | `src/vive-score/state.js` | une carga + cuestionario + cortes guardados |
| **Motor del índice** | `src/vive-score/score.js` → `evaluateRaw()` | **única fuente de cálculo del score** (5 factores, 15 subreglas) |
| Capacidad de endeudamiento (independiente) | `score.js` → `affordability()` | no afecta al score |
| Calidad de datos | `score.js` → `qualityReport()` | metodología separada, 0–100 |
| Patrones/anomalías | `score.js` → `patternModel()`, `timelineDiagnostics()` | descriptivo; no puntúa |
| Simulador | `score.js` → `scenario()` | llama a `evaluate()` (motor real) |
| Interfaz web y móvil | `frame.html` + `score.js` | **el mismo marco** para ambas; el móvil solo cambia la composición |

**Contradicción documentada.** Existen **dos implementaciones de capacidad de endeudamiento**: la del Resumen de la app (`v89DebtCapacity`: compromisos mensuales 56,018, ratio 3,9 % en la demo) y la del Score (`affordability`: cuotas 13,084, ingreso 0 en la demo). No comparten definiciones (la app incluye recurrentes y entre personas; el Score, tarjetas, préstamos y gastos fijos). No se unificaron: requiere decidir cuál es la definición vigente (ver §10).
**Una sola fuente del puntaje:** sí. Web, móvil, historial y simulador usan `evaluateRaw()`; no hay fórmulas paralelas del score.

## 2. Dimensiones y pesos (auditoría)
350/300/150/100/100 suman 1000 (verificado por prueba). Los pesos coinciden con la categorización **públicamente publicada** de FICO (pagos 35 %, montos adeudados 30 %, antigüedad 15 %, crédito nuevo 10 %, mezcla 10 %) y con la guía educativa citada en el módulo; **eso es una referencia, no una validación**: no se tienen datos de incumplimiento propios para calibrar. Se conservan, porque están justificados como convención educativa, y se declara su límite.

Dependencias y dobles penalizaciones identificadas:
- Una mora puede restar en **pagos** (atraso vigente) y, al cerrar el mes, como **antecedente**: por diseño se sustituye, no se suma (el módulo lo documenta); la severidad vigente está subponderada (H1 de la auditoría 07).
- «Crédito nuevo» (−15 por apertura) y «Antigüedad promedio» se mueven juntas al abrir un producto: es una dependencia real, no una duplicación (miden cosas distintas: aperturas recientes vs edad media).
- «Composición» entrega 93–100 de 100 por tener cualquier producto: aporta casi una constante (H3, auditoría 07).

## 3. Hallazgos nuevos de esta auditoría
| ID | Hallazgo | Evidencia | Gravedad |
|---|---|---|---|
| D-1 | **Discontinuidad en utilización:** la subregla «tarjetas tensionadas» resta en escalones (6 puntos por tarjeta ≥ 75 %, 12 por tarjeta > 100 %). Un punto porcentual de utilización mueve el puntaje 8 puntos en 74 → 75 % y 14 en 99 → 100 %; en el resto de la curva, ≤ 4. | `tests/vive-score-propiedades.js` R5 | **M** (el encargo pide evitar saltos desproporcionados) |
| D-2 | **Dos capacidades de endeudamiento** con definiciones distintas | §1 | **M** |
| D-3 | **Simulador incompleto:** soporta pagar tarjeta, subir límite, préstamo nuevo, mora, cambios de ingreso/gasto/tipo de cambio. **No** simula cancelar tarjeta, abonar capital a un préstamo existente, regularizar un atraso ni consolidar. | lectura de `scenario()` | **B/M** |
| D-4 | El préstamo hipotético se crea con «capital original = saldo»: sirve para ver su efecto inmediato, pero siempre aparece con 0 % de amortización | `scenario()` | **B** |
| D-5 | El tipo de cambio del corte se congela por mes en `ST.observed` (correcto: no usa información futura), pero el corte vigente usa el tipo de cambio actual | `state.js` | Conforme / informativo |
| D-6 | No hay recuperación progresiva explícita de una mora: se «recupera» solo porque la mora envejece fuera de la ventana de 12 o 24 meses (`lateOlder`, 8 puntos fijos por evento). Un evento antiguo nunca llega a cero. | `declaredCounters()` | **M** |

Hallazgos H1–H12 de la auditoría 07 siguen vigentes (mora vigente saturada en 35 puntos, expediente delgado «sólido», neutros que inflan, saldo del momento en lugar del corte, etc.).

## 4. Resultados de las pruebas (ejecutadas)
`tests/vive-score-propiedades.js` (12 comprobaciones, todas pasan) y `tests/vive-score.js` (39, todas pasan):

| Propiedad | Resultado |
|---|---|
| **Rango [0, 1000], entero, subpuntajes ≤ su máximo** | 2.885 cortes evaluados (de 6.000 generados; la mitad con valores hostiles: `null`, `NaN`, negativos, `Infinity`, texto, 1e15). **0 fuera de rango, 0 no enteros, 0 NaN, 0 excepciones.** Los cortes inválidos devuelven «sin datos» (null) en vez de un número. |
| Determinismo y pureza por corte | Pasa |
| Ponderaciones | 1000 = 350+300+150+100+100; cada factor = suma de sus subreglas |
| Monotonía (utilización, moras, días de atraso, antigüedad) | Pasa |
| Continuidad | Pasa salvo los dos umbrales de D-1 (documentados) |
| Sin obligaciones → «sin datos», no 0 ni 1000 | Pasa |
| Perfiles extremos (sin tarjetas, sin préstamos, 100 %, sobregiro, sin atrasos, atrasos recurrentes, refinanciado) | Pasan; límite 0 con saldo **suprime** el puntaje en vez de inventar uno |
| Multimoneda | La misma utilización en USD que en DOP da el mismo puntaje (838/838/838/838 con tipo de cambio 40, 60, 90) |
| Duplicados | **Nuevo:** advertencia de calidad de datos |
| Ingresos / liquidez / tipo de cambio | No mueven el puntaje de comportamiento |

**Matriz de sensibilidad** (efecto marginal de cada variable, por factor): `docs/auditoria/MATRIZ-SENSIBILIDAD-SCORE.md` (generada con `MATRIZ=1`). Resumen sobre un perfil de 831: +10 pp de utilización −11; +1 mora 30–59 d −75; +1 mora 60–89 d −100; +1 mora 90–119 d −135; mora **vigente** de 30 d −22 y de 90 d o más **−35** (tope); +12 meses de antigüedad +13; +1 apertura reciente −15; +1 aumento de límite solicitado −8; avance de efectivo del 25 % del límite −3; ingresos ×10, liquidez ×100 y tipo de cambio +20 %: 0.

## 5. Auditoría adversarial (resultado)
| Intento de manipulación | ¿Eleva el puntaje? | Estado |
|---|---|---|
| Duplicar tarjetas | No directamente: dos líneas con el mismo `id` se detectan como crítico y suprimen el puntaje | Cubierto |
| Producto ficticio sin saldo y sin límite | Cuenta como apertura (−15) y como antigüedad; no mejora la utilización | Aceptable |
| Subir el límite artificialmente | **Sí:** baja la utilización (mejora hasta +55 puntos entre 100 % y 0 %). El historial de límites registra el cambio con fecha, pero el índice no lo penaliza si es «automático». | **Riesgo M**: pendiente de decisión |
| Eliminar obligaciones | Las eliminadas/archivadas salen del cálculo; si queda alguna, mejora. Sin obligaciones: «sin datos». | Riesgo **M** (por diseño) |
| Pago duplicado de tarjeta | Reduce deuda dos veces → mejora | **Ahora se advierte** (nuevo); no se corrige |
| Mover deuda entre productos | Si la utilización agregada baja, mejora; la tarjeta más usada y las «tensionadas» lo limitan | Parcialmente cubierto |
| Cambiar la antigüedad | Sube hasta +150 puntos máximo; la fuente se marca (app / usuario / falta) y el módulo pide evidencia | Cubierto parcialmente |
| Pagar justo antes de medir | +85 puntos (H4) | **Riesgo M**: pendiente (saldo al corte) |
| Datos incompletos | Se suprimen con alertas críticas o bajan la confianza | Cubierto |

## 6. Inteligencia estadística
La segmentación (k-means) y la detección de atípicos (mediana y MAD) son **descriptivas**: etiquetan un mes como «atípico» o con «cambio de régimen» y lo dicen con un aviso explícito («No implica morosidad futura»). No hay modelo predictivo ni probabilidad de impago. Con la muestra actual (un cliente, historial desde noviembre de 2026) no hay base para entrenar nada con validez científica: **se conserva el sistema determinista explicable**. Conclusión del comité: la pieza estadística es prudente en su redacción y no debe ampliarse sin datos de resultados.

## 7. Calidad de datos
`qualityReport()` ya existe como metodología independiente (0–100) con alertas de evidencia, fechas futuras, saldos antiguos (> 65 días) y profundidad < 12 meses. **Falta** distinguir de forma explícita «información desactualizada» frente a «contradictoria» y mostrar la confianza junto al número (H7). Propuesta en §10.

## 8. Historial y versionado
- Cada corte guardado (`ST.observed`) congela sus hechos y su tipo de cambio: el puntaje de un mes se calcula **solo con la información de ese mes** (prueba de pureza por corte: pasa).
- Cada sello (`seals`) guarda la versión del motor (`engine: '5.0.0'`) y la fecha. **Limitación:** si se cambian reglas, los cortes anteriores se recalculan con el motor nuevo; solo los sellos conservan la versión usada. Propuesta: guardar `engine` y el puntaje en cada corte observado.

## 9. Fuentes consultadas (y su alcance)
| Fuente | Qué aporta | Límite |
|---|---|---|
| [myFICO · What's in my FICO Scores](https://www.myfico.com/CreditEducation/WhatsInYourScore.aspx) y [myFICO, «What's not in my score»](https://www.myfico.com/credit-education/blog/important-ask-whats-not-fico-score) | Categorías y pesos publicados (35/30/15/10/10); los ingresos no forman parte del score | Pesos de la **versión comercial**; no son una fórmula |
| [Superintendencia de Bancos RD · carta circular SIB 010-17 sobre el REA](https://www.sb.gob.do/media/jsdjg3id/20171103_carta_circular_sib_010-17_notificar_entrada_en_vigencia_de_algunos_aspectos_del_rea.pdf) y el [Reglamento de Evaluación de Activos](https://sb.gob.do/media/xnanx3o3/reglamento_de_evaluacion_de_activos_rea_28_09_2017.pdf) | El REA clasifica el riesgo de pago en cinco categorías (A normal a E irrecuperable) y considera capacidad de pago y comportamiento de pago | Es una **obligación de las entidades**, no de este producto; no pude leer el texto íntegro de los artículos |
| [Superintendencia de Bancos RD · circular SB CSB REG 2026-000006 (uso de la Central de Riesgos)](https://www.sb.gob.do/media/iy3fij4j/circular-sb-csb-reg-2026000006-uso-de-informaci%C3%B3n-en-la-central-de-riesgo-signed.pdf) | Reglas sobre el uso de la información de la Central de Riesgos | Vive el Score **no usa** la Central de Riesgos |
| [Fed · SR 11-7](https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm) (indica que fue sustituida por [SR 26-2](https://www.federalreserve.gov/supervisionreg/srletters/sr2602.htm)) | Marco de gestión del riesgo de modelos: desarrollo, validación, gobierno | Es de EE. UU.; **referencia metodológica**, no norma aplicable |
| [BCBS 239 (BIS)](https://www.bis.org/publ/bcbs239.htm) | Principios de agregación de datos de riesgo y reporte (trazabilidad, exactitud, integridad) | Para bancos sistémicos; se usa como criterio de calidad de datos |
| [TransUnion RD · factores del score](https://www.transunion.do/blog/factores-score-crediticio) (ya citada en el módulo) | Factores y desfases de actualización | La fórmula es propietaria; no se reproduce |

**Obligaciones regulatorias aplicables:** ninguna a este producto como tal (no es una entidad regulada ni un buró). **Referencias metodológicas:** las anteriores. **Decisiones internas:** pesos, curvas, umbrales y topes.

## 10. Cambios que necesitan tu autorización (estructurales)
Cada uno cambia puntajes. Presento qué, por qué, evidencia, impacto, riesgo y alternativa.

| # | Qué | Por qué / evidencia | Impacto | Riesgo | Alternativa |
|---|---|---|---|---|---|
| E1 | Severidad de la mora vigente con la escala del atraso declarado (18/75/100/135/165 puntos) | 672 d de mora = 35 puntos (H1) | Perfiles con atraso vigente bajan | Penaliza un pago no conciliado → se combina con E6 | Subir el tope de 35 a un valor intermedio |
| E2 | Mostrar **confianza** junto al puntaje y tope «en desarrollo» con < 12 meses de evidencia | 1 mes de datos = «sólido» (H2) | Solo presentación + etiqueta | Bajo | Mostrar la confianza sin tope |
| E3 | Suavizar los escalones de «tarjetas tensionadas» (D-1) con rampa continua entre 60 % y 100 % | D-1 | ±0–4 puntos en perfiles con tarjetas altas | Bajo | Mantener y documentar |
| E4 | Neutros explícitos y composición condicionada a meses de gestión (H3) | 803 sin tarjetas | Baja perfiles sin evidencia | Medio | Dejarlo y marcar el factor «incompleto» |
| E5 | Utilización al **saldo del corte** (H4) | +85 por pagar antes de medir | Cambia el puntaje del día | Medio | Mostrar ambos |
| E6 | Confirmar el atraso proveniente de vencimientos sin conciliar antes de contarlo como mora | H6 | Evita castigos injustos | Bajo | Solo advertir (ya lo hace) |
| E7 | Recuperación progresiva de moras (D-6): reducir el descuento histórico por evento según meses sin reincidencia | D-6 | Sube perfiles recuperados | Medio (decisión de política) | Mantener ventanas de 12/24 meses |
| E8 | Ampliar el simulador (cancelar tarjeta, abonar préstamo, regularizar atraso) usando `evaluate()` | D-3 | Aditivo | Bajo | — |
| E9 | Unificar la capacidad de endeudamiento (D-2) en una sola definición | D-2 | Cambia cifras visibles | Medio | Etiquetarlas distinto |
| E10 | Guardar versión del motor y puntaje en cada corte | §8 | Aditivo | Bajo | — |

## 11. Cambios realizados (aditivos, reversibles)
- **Alerta de posibles movimientos duplicados en tarjetas** (`adapter.js`, `state.js`, `score.js`): solo avisa; no corrige ni omite nada.
- **`tests/vive-score-propiedades.js`** y la **matriz de sensibilidad**.
- Los cambios de la sesión anterior (Destino de tu dinero con compras con tarjeta) no tocan el score.
- **No se modificó** ningún peso, fórmula, umbral ni dato histórico.

## 12. Riesgos pendientes y confiabilidad
**Nivel de confiabilidad: parcial.** El motor es consistente matemáticamente (rango, determinismo, monotonía, multimoneda, ausencia de errores con entradas hostiles), pero **no puede defenderse todavía como medida de comportamiento** por H1 y H2 y por la falta de validación empírica. No está validado al 100 %: faltan datos de resultados, calibración de curvas, una auditoría externa y la decisión sobre E1–E10. La revisión del comité fue una revisión cruzada interna de un solo ejecutor.

---

## 13. Implementación autorizada (motor 5.1.0)
Con tu autorización de E1–E10 se implementó lo siguiente. El motor pasó de `5.0.0` a `5.1.0`; los sellos y cortes nuevos guardan esa versión.

| # | Cambio | Dónde | Verificación |
|---|---|---|---|
| E1 | La mora **vigente** usa la escala de severidad del atraso declarado (18/75/100/135/165, peor producto); ya no se satura en 35 | `score.js` (`evaluateRaw`) | Prueba E1: 0 d → 866; 15 d → 837; 45 d → 766; 75 d → 735; 100 d → 696; 200 d → 666; 672 d → 666 |
| E2 | Etiqueta «**Perfil en desarrollo**» mientras haya < 12 meses de evidencia o de antigüedad promedio, y la **confianza** se muestra bajo el título (web y móvil) | `score.js` (`isDeveloping`, `confidenceOf`, `scoreName`) | Prueba E2 + captura web |
| E3 | «Tarjetas tensionadas» sin escalones: rampas lineales 60 %→75 % (6 pts) y 100 %→110 % (12 pts) | `score.js` | Prueba R5: ≤ 4 puntos por punto porcentual en toda la curva, sin escalones |
| E4 | Neutros al 50 % cuando no hay evidencia (sin tarjetas: 90/180, 22/45, 8/15; sin préstamos: 18/35); composición de «gestión» proporcional a la antigüedad promedio (÷ 24 meses) | `score.js` | Prueba E4: 2 meses de historia 756 frente a 10 años 961 |
| E5 | Utilización medida con el **saldo del estado de cuenta** cuando existe | `adapter.js` (`statementKnown`), `score.js` | Prueba E5. **Límite:** si la app reduce el saldo facturado al registrar el pago, el efecto se reflejará al siguiente corte |
| E6 | **Confirmación de atrasos** en Centro de control → «Productos y cancelados»: «No es mora · ya pagué» (atada al vencimiento concreto; si aparece otro, vuelve a contar) | `state.js`, `settings.js` | Prueba E6 + comprobación en pantalla |
| E7 | **Recuperación progresiva** de atrasos antiguos: el descuento decrece linealmente y llega a 0 a los 60 meses de salir de su ventana | `state.js` (`declaredCounters`) | Prueba E7: 1, 0,8, 0,6, 0,2, 0, 0 |
| E8 | Simulador con **abonar 20 % del capital**, **regularizar atrasos** y **consolidar saldos** (12 escenarios en total, todos por `evaluate()`) | `transunion.js` | Prueba E8 |
| E9 | **Parcial.** No se unificó el cálculo: se rotuló la definición y se explica por qué difiere de la del Resumen. Unificar exige decidir qué incluye «capacidad» | `score.js` | — |
| E10 | **Parcial.** Cada corte guarda `engine` y, al cerrarse, `closedEngine`. No se guarda el puntaje de cada corte (se recalcula) | `state.js` | Prueba E10 |
| D-5/duplicados | Alerta de duplicados (ya hecha) | — | Prueba R10 |

**Antes y después sobre el perfil de demostración** (con datos sintéticos; sus atrasos de 650–672 días provienen de vencimientos sin pago registrado): **831 → 666**. La caída se debe sobre todo a E1 (mora vigente) y E4/E2 (expediente de un mes). Marcar el atraso como «no es mora» lo devuelve al nivel anterior; el puntaje sigue etiquetado «Perfil en desarrollo» hasta reunir 12 meses de evidencia.

**Pruebas:** `tests/vive-score.js` 39/39 (se actualizaron dos expectativas: 12 escenarios en vez de 9 y el neutro de amortización 18 en vez de 26); `tests/vive-score-propiedades.js` 20/20 (rango y enteros en 2.885 cortes de 6.000 con valores hostiles, determinismo, monotonía, multimoneda, extremos y E1–E10).

**Pendiente y riesgos residuales**
- **Código sin uso:** `scenario()` y sus controladores de `sim` en `score.js` quedaron huérfanos (la pantalla que los usaba ya no existe; el simulador vigente es `tuScenarios()`). No se eliminaron: se lista aquí para decidir su borrado.
- **D-2** (dos capacidades) solo etiquetado (E9).
- **Calibración:** las curvas, topes y el factor 60 meses de E7 son decisiones de política, no estimaciones estadísticas.
- **Subir el límite artificialmente** sigue mejorando la utilización (la matriz lo muestra); no se penaliza. Es una decisión de diseño pendiente.
- El puntaje por corte histórico se recalcula con el motor vigente; solo se conserva la versión del motor, no el puntaje original.
- No hay validación predictiva ni auditoría externa. **Confiabilidad: media** (consistente y reproducible, pero sin calibración empírica).
