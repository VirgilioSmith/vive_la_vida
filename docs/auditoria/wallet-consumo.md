# Auditoría del consumo y crédito de Wallet

## Alcance y fuentes

Auditoría de código y pruebas con un libro simulado. No se accedió a una cuenta real ni se modificaron registros financieros. El cálculo es local sobre el documento cargado desde `finance_items` / `finance_values`; `finance_revision` controla la sincronización. Las colecciones relevantes son `transactions`, `cards`, `statements`, `recurring` y `settings`. Wallet no ejecuta una consulta remota por gráfico. La tarjeta virtual no se almacena como una tarjeta real.

| Indicador | Fuente y cálculo |
| --- | --- |
| Consumo histórico neto | `v1301WalletConsumption`: transacciones de cada tarjeta, sin límite de antigüedad y hasta hoy. Compras menos devoluciones. |
| Consumo mensual | La misma clasificación, agrupada por mes de la fecha de contabilización. Un mes sin registros tiene consumo 0; no se muestra un nuevo widget. |
| Consumo por tarjeta | La suma de la tarjeta individual; el consolidado suma las tarjetas incluidas en el carrusel. Las tarjetas ocultas respetan la configuración existente. |
| Equivalencia histórica | RD$ neto + suma de cada compra o devolución USD multiplicada por su `fxRateSnapshot`. Si no existe, se utiliza la tasa configurada como estimación. Una tasa ausente impide presentar un equivalente verificado. |
| Límite | `cards.limitDOP` y `cards.limitUSD`; equivalente a tasa actual `settings.fx`. Excluye sobregiros autorizados adicionales. |
| Deuda utilizada | `cardStatus` → `v102CardStatusRaw`: saldo inicial y cargos, menos pagos, devoluciones y créditos aplicados, considerando ajustes y avances. No confunde deuda con consumo. |
| Crédito disponible | Por tarjeta y moneda: `max(0, límite contractual − deuda)`. Equivalente = disponible RD$ + disponible USD × tasa actual. El total suma cada disponible; un exceso en una moneda o tarjeta no cancela el crédito de otra. |
| Utilización | Deuda equivalente / límite equivalente × 100. Se conserva un porcentaje superior a 100% cuando hay exceso; solo la geometría de la dona se limita a su capacidad. |
| Cortes pendientes | Lotes abiertos del libro (`v102CardStatusRaw`, `cutFor`, `cardDue`), abonos aplicados a cargos anteriores y suma de lotes facturados pendientes. El consolidado suma por moneda y toma el vencimiento pendiente más antiguo. Los estados bancarios manuales (`statements`) son referencias separadas (`officialRemaining`); no sustituyen movimientos del libro. |
| Participación | Consumo neto equivalente de la tarjeta / consumo neto equivalente total, con precisión antes de formatear. Una distribución de valores negativos o sin tasa verificable no se representa como segmentos positivos ficticios. |

## Clasificación financiera

- `card_charge`: compra registrada, incluyendo compras domiciliadas, suscripciones y Apple Pay importado o pendiente de categorizar. Las compras en cuotas se contabilizan según los cargos efectivamente registrados; no se multiplica una compra por cuotas futuras ni se generan movimientos ficticios.
- `card_refund`: resta en la fecha de la devolución. Si tiene `originalPurchaseId`, la compra debe corresponder a la misma tarjeta y moneda; una devolución de costos bancarios no reduce el consumo comercial. Las devoluciones antiguas sin vínculo se reconocen como devoluciones registradas.
- Excluidos del consumo: pagos, transferencias, avances de efectivo, ajustes, recompensas, anualidades, intereses, seguros de tarjeta, comisiones, emisión y renovación. Estos pueden afectar deuda o beneficios según su propia naturaleza.
- Identidad: se reconoce una única vez cada ID de movimiento y cada `applePayEventId`. Dos compras distintas con igual comercio, fecha e importe no se fusionan. Fechas inválidas, monedas no compatibles e identidades en conflicto generan advertencias de auditoría en consola; no se modifica el libro ni se resuelve automáticamente un conflicto entre registros diferentes.
- Se conserva la precisión de la moneda original y de la conversión para participaciones. Los importes visuales consolidados se muestran redondeados según el diseño existente, sin reescribir los valores almacenados.

## Hallazgos y correcciones

1. El consumo anterior sumaba cargos positivos y omitía las devoluciones. Ahora calcula consumo neto y distingue costos bancarios, incluyendo los tipos de emisión y renovación.
2. La conversión histórica utilizaba la tasa actual sobre todos los dólares. Ahora utiliza la tasa del movimiento cuando está disponible, en línea con el registro histórico; las tasas antiguas ausentes tienen una limitación de calidad explícita.
3. El disponible individual consolidaba primero límites y deuda, lo que permitía una divergencia respecto al desglose por moneda cuando existía exceso. Ahora ambos niveles suman los disponibles por moneda.
4. La utilización individual se truncaba al 100%, a diferencia del consolidado. Ambos muestran el cociente real.
5. El índice de transacciones de tarjetas ahora utiliza identidades únicas para evitar una doble lectura del mismo movimiento, incluido Apple Pay. La cuenta bancaria y la persistencia permanecen fuera del cambio.
6. Se eliminó el cálculo de una serie de meses artificialmente rellenados que servía al widget histórico ya eliminado. Se mantienen los totales mensuales internos a partir de fechas reales, sin reincorporar el widget.

## Pruebas

- `node --test tests/logica/wallet-consumo.test.js`: compras de 1999, reembolsos vinculados y antiguos, compras y cuotas registradas, suscripciones, coste bancario y su devolución, repetición por ID y evento, dos tasas USD, saldo mensual, conversión sin tasa y protección del libro.
- `tests/wallet-credit-global.js`: Playwright en Chromium y WebKit (390 × 844, Claro y Black). Incluye consolidación, cortes, límites, participación y centavos, saldo disponible con sobregiro individual, utilización superior a 100%, tasas históricas y duplicados, navegación y ausencia del widget eliminado. La segunda prueba reconstruye resultados esperados independientes con importes conocidos.
- `tests/home-mobile-header.js`: Playwright en 320, 390 y 430 px (Claro y Black); ausencia de los tres botones de Inicio, posición de la matriz y tendencia de patrimonio sin hueco reservado, navegación y capturas.

## Límites de la evidencia

El historial depende de los datos registrados; no se pueden certificar compras no importadas, detectar todas las posibles duplicidades sin identidad compartida ni validar contra estados de cuenta bancarios no proporcionados. No se estiman compras a partir de saldos iniciales. Los estados oficiales discordantes y duplicados ambiguos requieren revisión contra el comprobante original. El resultado de ejecución de Playwright queda en GitHub Actions y no se presume aprobado hasta que ese trabajo termine.
