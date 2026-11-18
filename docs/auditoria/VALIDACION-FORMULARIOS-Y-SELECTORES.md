# Validación de formularios, menús y selectores universales

Pedido: recorrer la aplicación como una persona (creación de cuentas, tarjetas, ingresos, pagos…) y comprobar que **todos** los selectores universales muestran **todos** los productos, en pesos y en dólares; en particular «Pagar tarjeta».

## Hallazgos y correcciones
| # | Hallazgo (reproducido) | Causa raíz | Corrección |
|---|---|---|---|
| 1 | **«Pagar tarjeta»** (y la cuota de préstamo, su edición, el cashback y el avance) usaban listas nativas, sin logos, moneda ni buscador | El selector universal se saltaba el formulario de movimientos (`transactionForm`) salvo en dos casos de certificados | El selector universal se aplica a **todos** los formularios de captura y a los campos `cardId`, `accountId`, `loanId`, `autoAccountId`, `toAccountId` |
| 2 | Los selectores universales **ocultaban** los productos que la operación no admite (p. ej. cuentas en dólares en un pago en pesos): «no me da todos los productos» | Cada formulario filtraba sus opciones y el selector solo mostraba lo filtrado | El selector parte de **todos los productos activos**; los no admitidos aparecen atenuados y con el motivo («No disponible: esta operación es en DOP», «el avance se recibe en una cuenta bancaria») |
| 3 | «Avance de efectivo» mostraba solo 2 de 5 cuentas (sin efectivo ni dólares) | Su selector propio listaba solo cuentas bancarias de la misma moneda | Lista las 5 cuentas; efectivo y otra moneda atenuadas con motivo |
| 4 | Guardar una cuenta nueva sin elegir institución no hacía nada visible (solo un aviso en la consola del navegador) | El asistente de varios pasos oculta el campo nativo y solo valida al pulsar «Continuar», no al guardar | **Pendiente**: el asistente avisa al pulsar «Continuar» (verificado); no se alteró el guardado directo |

## Resultado de la auditoría de selectores (`tests/auditoria-selectores.js`)
Se abrió cada formulario o asistente alcanzable desde las 26 pantallas y el asistente de registro, en móvil (390 px) y escritorio (1440 px), y se abrió cada selector para leer sus filas.
| Medida | Antes | Después |
|---|---|---|
| Listas de productos revisadas | 24 únicas | 30 únicas |
| Sin selector universal | 12 (Pagar tarjeta ×2, cuota de préstamo ×2, edición de cuota ×2, nuevo préstamo, avance ×2, cashback…) | **0** |
| Listas que no mostraban todos los productos | 5 (servicio, ingreso recurrente, nuevo préstamo, avance…) | **0** |
| Prueba permanente | — | `tests/selectores-universales.js` (13 comprobaciones, todas correctas) |

## Recorrido natural de creación (`tests/recorrido-creacion.js`)
| Formulario | Resultado |
|---|---|
| Banco, cuenta, relación entre personas, categoría | Creados desde la interfaz paso a paso; el producto nuevo aparece en los selectores (6 cuentas en «Pagar desde») |
| Préstamo, certificado, pago recurrente (suscripción y servicio), tarjeta | **OMITIDOS: no cuentan como aprobados.** Son asistentes con tarjetas de elección y campos propios que el rellenador genérico no completa; requieren un guion específico. Sus **selectores** sí se auditaron y cumplen |
| Errores de página | 0 |

## Qué no se comprobó
* La creación de **tarjeta** desde la interfaz (el botón no se encontró con el rastreador genérico), aunque su selector de institución sí se auditó.
* Pagos entre monedas distintas: el selector ya los muestra, pero esta validación no ejecutó el cobro cruzado de punta a punta.
* Dispositivos reales (iPhone) y datos de producción.
