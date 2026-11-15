# Metodología de cálculo

Todas las fórmulas viven en `src/lib/finanzas/reglas.js` (funciones puras, sin datos ni reloj). La app aplica hoy las mismas fórmulas dentro de `src/app.js`; las pruebas de paridad (`tests/logica/paridad.js`) comparan ambas en cada ejecución.

## Reglas generales
- **Redondeo:** dos decimales, mitad hacia arriba, solo al producir un importe. Los pasos intermedios no se redondean, salvo el interés de cada periodo de un préstamo, que sí es un importe (se cobra redondeado).
- **Fechas:** de calendario (AAAA-MM-DD), sin hora. «Hoy» debe ser la fecha en `America/Santo_Domingo` (función `hoy`).
- **Día del mes:** 29, 30 y 31 se ajustan al último día del mes sin cambiar el día contractual.
- **Signo:** ingresos suman; gastos, pagos y constituciones restan; vencimientos de certificado suman; una transferencia resta del origen (monto + comisión) y suma en el destino (monto destino). Nada se cuenta dos veces: cada movimiento afecta a una cuenta por su campo de cuenta.

## Certificado (interés simple, base 365)
- `bruto = Σ(capital × días) × tasa / 36 500` (capital constante: `capital × días × tasa / 36 500`).
- `retención = bruto × % retención / 100` (sobre los intereses, nunca sobre el capital).
- `neto = bruto − retención`. No se descuenta otra vez del saldo: el capital sale de la cuenta solo con la constitución.
- Comprobación con la imagen de referencia: capital 100 000, 8 %, 365 días, retención 10 % → bruto 8 000, neto 7 200. ✔
- Año bisiesto: 366 días con la misma base 365 (el interés es proporcional a los días reales).

## Tarjeta de crédito
- **Corte:** `corteQueCierra(fecha, día)`; **último corte:** `ultimoCorte`; **pago:** primer día de pago posterior al corte (`fechaDePago`).
- **Pago mínimo:** `facturado × % mínimo / 100`.
- **Avance de efectivo:** `comisión = efectivo × % / 100`; `total = efectivo + comisión`.
- **Pago para no generar intereses:** saldo facturado al corte menos los pagos aplicados. La app no calcula intereses por saldo; la tasa anual es informativa (D4).
- **Anualidad:** un cargo por tarjeta, en una moneda; se contabiliza al registrar el cobro.

## Préstamo
- `cuota = capital × r / (1 − (1 + r)^−n)` con `r = tasa anual / 1200 / periodos por mes` (r = 0 → capital / n).
- Cada fila: `interés = saldo × r`; `capital = cuota − interés`; la última fila cancela el saldo restante.
- Seguro y cargos mensuales se reparten entre periodos (quincenal: primera mitad redondeada y el resto en la segunda).
- Pagos reales: solo los confirmados por el usuario cuentan como amortizados.

## Cuenta
`saldo = apertura (si ya estaba abierta) + Σ efecto de cada movimiento con fecha ≤ fecha de consulta`. No depende del orden de los movimientos.

## Monedas
Un monto en US$ se convierte con la **tasa guardada en el registro**; solo si falta se usa la tasa vigente.

## Vigencias (el pasado no se modifica)
- Una regla se guarda como lista de vigencias `{clave, sujeto, valor, desde}`. El fin de cada una es el inicio de la siguiente.
- Editar una regla = **agregar** una vigencia nueva con fecha posterior a la última; no se sobrescribe ni se borra ninguna. Una fecha anterior o igual a la última se rechaza.
- Al crear o calcular un registro se guarda una **instantánea inmutable** con las reglas y resultados vigentes (`instantanea`). Un cambio de regla no la toca.
- En la base de datos: tablas `finance_rule_versions` y `finance_record_snapshots` (solo insertar, con disparadores que impiden actualizar o borrar, y acceso por usuario). Migración y reversión en `supabase/migrations` y `supabase/rollback`.

## Discrepancias: estado
| # | Hallazgo | Qué se hizo | Estado |
|---|---|---|---|
| D1 | «hoy» usaba la zona del dispositivo | `today()` ahora devuelve la fecha de `America/Santo_Domingo` (capa pura `hoy`). Para quien está en esa zona no cambia nada | **Corregida** |
| D2 | El interés del certificado se recalculaba con la tasa y retención actuales | Cada cambio de tasa o retención agrega una vigencia desde hoy (la primera guarda las condiciones previas desde la constitución). El interés se calcula por tramos: lo devengado antes del cambio no se recalcula. Cada certificado nuevo guarda su vigencia inicial y una instantánea | **Corregida** (certificados nuevos y editados desde ahora) |
| D3 | Varios cálculos convertían US$ con la tasa vigente | Se usa la tasa guardada con el movimiento (`txDop`) en beneficios, cashback, préstamos entre personas, intereses de certificados y rendimiento; si falta, la vigente. Los movimientos que no tenían tasa y se completaron al cargar se marcan `fxRateEstimated`. La tasa vigente ya guarda fuente y fecha (`fxSource`, `fxRateDate`) | **Corregida** |
| D4 | Intereses de tarjeta | Verificación: la app **sí** muestra un interés mensual orientativo (facturado × tasa / 12) en el detalle de la tarjeta, que no se registra. Ahora usa la capa pura (`interesTarjetaMensual`). Se agrega `interesTarjetaEstimado` (diario) como método alternativo, sin mostrar | **Aclarada**; el método diario requiere tu decisión |
| D5 | Pago mínimo sin piso | Campo opcional «monto mínimo» (vacío = como antes). Cada cambio del porcentaje o del piso crea una vigencia desde hoy; los cortes anteriores conservan su mínimo | **Corregida** |
| D6 | Tasa del préstamo con dos niveles | El préstamo ya guardaba `conditionHistory`, pero el cálculo solo leía la tasa inicial y la vigente. Ahora cada fecha usa la tasa registrada para su tramo; sin historial, igual que antes | **Corregida** |
| D7 | Dos funciones de redondeo | `v900Round` delega en `rnd` (una sola regla); la función se conserva | **Corregida** |
| D8 | Centavos por redondeo de interés de préstamo | Se mantiene: es lo que se cobra | Sin acción |

### Reglas que ya estaban protegidas de otra forma
- **Día de corte y de pago de la tarjeta, banco, saldos iniciales:** con historial no se pueden cambiar (la app lo rechaza). Una configuración con fecha efectiva queda pendiente: exige separar todos los ciclos por vigencia.
- **Comisión por avance y anualidad:** cada operación guarda su importe al registrarse; un cambio posterior no los recalcula.
- **Cuota del préstamo:** `installmentHistory` ya conserva cada cuota con su fecha de vigencia.

## Instantáneas en la app
Se guardan al crear cuenta, tarjeta, certificado y préstamo (`recordSnapshots`: reglas y resultados del momento). En la base de datos, la tabla correspondiente impide actualizar o borrar; en el documento local de la app solo se agregan.
