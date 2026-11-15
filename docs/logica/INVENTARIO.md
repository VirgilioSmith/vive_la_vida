# Inventario de cálculos

Archivo de referencia: `app.js` (los números son líneas). Los identificadores con prefijo `v…` son nombres internos ya existentes; se citan solo para poder localizarlos.
Estado: **verificado** = leído y comparado con la versión pura (`lib/finanzas/reglas.js`) con pruebas de paridad; **localizado** = ubicado y descrito, sin prueba de paridad todavía.

## Base común
| Cálculo | Dónde | Entradas | Salida | Regla | Estado |
|---|---|---|---|---|---|
| Número seguro | `num` 130 | cualquier valor | número (0 si no es finito) | — | verificado |
| Redondeo | `rnd` 130 (también `v900Round` 17891) | número | 2 decimales, mitad hacia arriba | dos funciones idénticas | verificado |
| Fecha de hoy | `today` 120 | reloj del dispositivo | AAAA-MM-DD | zona `America/Santo_Domingo` | verificado |
| Día válido del mes | `monthDay` 124 | año, mes, día | fecha con el día limitado al último del mes | 29/30/31 se ajustan | verificado |
| Sumar meses | `plusMonths` 125 | fecha, n | fecha | conserva el día; limita al fin de mes | verificado |
| Diferencia de días | `diffDays` 128 | dos fechas | días enteros | calendario, sin hora | verificado |

## Cuentas
| Cálculo | Dónde | Entradas | Salida | Regla | Estado |
|---|---|---|---|---|---|
| Saldo de cuenta | `v102AccountBalanceRaw` 229 (envoltorio `getAccountBalance` ~10352) | apertura, fecha de apertura, movimientos hasta la fecha | saldo | ingreso/recompensa +, gasto −(monto+impuestos), ajuste +, constitución de certificado −, vencimiento +, avance de tarjeta + (neto), pago de tarjeta/préstamo −(origen+impuestos), transferencia −(monto+comisión) / +(monto destino) | verificado (paridad con la versión pura) |
| Totales del mes | `v102MonthlyTotalsRaw` 358 | movimientos del mes, tasa guardada | ingresos, gastos por categoría, efectivo, pagos de tarjeta, capital e intereses | convierte USD con `fxRateSnapshot` o, si falta, la tasa vigente | localizado |
| Compromisos próximos | `v102UpcomingRaw` 413 | tarjetas, préstamos, recurrentes | lista de vencimientos | usa estado de tarjeta y cuota de préstamo | localizado |
| Recurrentes | `v96NextRecurringDate` 403 | fecha, frecuencia, día ancla | próxima fecha | semanal, quincenal 15/30, mensual a anual con día ancla | localizado |
| Capacidad de endeudamiento | `v99DebtMonth` 10515 (`v89DebtCapacity` 10853) | ingresos cobrados y pendientes, cuotas | porcentaje y disponible | informativo, no es el DTI de un prestamista | localizado |

## Certificados
| Cálculo | Dónde | Entradas | Salida | Regla | Estado |
|---|---|---|---|---|---|
| Capital invertido | `certificateCapital` 376 | capital, modo (ya constituido/pendiente), constituciones y rescates hasta hoy | capital | pendiente: suma de constituciones; resta rescates | localizado |
| Proyección | `certProjection` 382 | capital por día, tasa, retención, fechas | días, bruto, retención, neto, cobrado | interés simple: Σ(capital × días) × tasa / 36 500; retención sobre el interés; neto = bruto − retención | verificado |
| Estimación en el formulario | formulario de certificado, paso de confirmación | capital, tasa, retención, fechas | bruto y neto | misma fórmula con capital constante | verificado |

## Tarjetas
| Cálculo | Dónde | Entradas | Salida | Regla | Estado |
|---|---|---|---|---|---|
| Corte que cierra una fecha | `cutFor` 242 | fecha, día de corte | fecha de corte | mismo mes si aún no pasó, si no el siguiente | verificado |
| Último corte | `lastCutAt` 243 | fecha, día de corte | fecha | corte ≤ fecha | verificado |
| Fecha de pago | `cardDue` 246 | corte, día de pago | fecha | primer día de pago posterior al corte | verificado |
| Ciclo y estado | `v102CardStatusRaw` 342, `v169CardCycleLedger` 251 | movimientos por moneda, límite, sobregiro, apertura | deuda, facturado, no facturado, vencido, disponible, estado en el corte, próximo pago | los pagos se aplican a los cargos más antiguos; el exceso queda a favor | localizado |
| Pago mínimo | ciclo de la tarjeta (~329) | facturado, % y piso vigentes en el corte | mínimo | máx(facturado × %, piso), sin superar lo facturado | verificado |
| Avance de efectivo | 17903 | efectivo recibido, comisión % | comisión y total | comisión = efectivo × % ; total = efectivo + comisión | verificado |
| Anualidad | 1027 y 1388 | monto, moneda, fecha de renovación | cargo único por tarjeta | se contabiliza como gasto solo al registrar el cobro | localizado |
| Interés orientativo de la tarjeta | detalle de tarjeta (`cardDetail`, ~1756) | saldo facturado, tasa anual | interés mensual | facturado × tasa / 12; informativo, no se registra | verificado |
| Pagos para no generar intereses | estado de tarjeta | saldo facturado | monto | = facturado al corte (menos pagos aplicados) | localizado |

## Préstamos
| Cálculo | Dónde | Entradas | Salida | Regla | Estado |
|---|---|---|---|---|---|
| Periodos por mes y total de cuotas | `v49LoanPeriodsPerMonth` 1742, `v49LoanPeriodCount` 1743 | frecuencia, plazo | cuotas | mensual 1, quincenal 2 | verificado |
| Fechas de cuota | `v49LoanPeriodDate` 1749 | primera cuota, índice | fecha | día contractual anclado; quincenal 15/30; febrero se corrige | localizado |
| Interés del periodo | `v49LoanPeriodInterest` 1766 | saldo, tasa (vigente desde `rateEffectiveFrom`) | interés | saldo × tasa / 1200 / periodos por mes | verificado |
| Amortización original | `v102FullOriginalLoanRaw` 1774 | capital, tasa, plazo, seguro, cargo | cuota, filas, intereses | cuota nivelada; interés redondeado por periodo; la última fila ajusta el capital | verificado |
| Reconstrucción histórica | `v88LoanReconstruction` 1790 | saldo declarado, fechas | filas estimadas y conciliación | no atribuye pagos no confirmados | localizado |
| Estado contable | `v102LoanAccountingRaw` 1819 | pagos registrados | saldo, siguiente cuota, periodos pagados | pagos manuales confirmados | localizado |
| Cuota del periodo | `v86InstallmentForDate` 10988 | cuota exacta, vigencia de cuota | cuota | cuota exacta si existe; si no, la nivelada | localizado |

## Monedas, beneficios y Apple Pay
| Cálculo | Dónde | Entradas | Salida | Regla | Estado |
|---|---|---|---|---|---|
| Conversión USD → RD$ | `fx` 194, `xconvert` 195, `v144AmountDOP` 11726 | monto, moneda | RD$ | `fx` usa la tasa vigente (`db.settings.fx`, con fuente y fecha); los movimientos usan `txDop` (tasa guardada) | verificado |
| Tasa guardada por movimiento | `fxRateSnapshot` (se completa en la carga, 7915) | tasa al registrar | — | los totales mensuales la usan; otros cálculos no | localizado |
| Beneficios y resumen anual | `v144PeriodMatch` 11728, `v144CostPaid` 11734, `v144AmountDOP` 11726 | cargos, pagos, año y mes elegidos | valor recibido y costo pagado | convierte con la tasa vigente | localizado |
| Apple Pay | `v5ApplePayPending` 13193, 6881 y siguientes, función `apple-pay-ingest` | eventos de compra | movimientos pendientes y confirmados | cada evento se vincula por `applePayEventId`; no duplica | localizado |
| KPIs de los resúmenes | `v102MonthlyTotalsRaw` 358 y vistas de resumen | totales del mes | porcentaje, promedios | derivados de los totales mensuales | localizado |
