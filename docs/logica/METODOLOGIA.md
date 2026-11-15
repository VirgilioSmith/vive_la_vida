# Metodología de cálculo

Todas las fórmulas viven en `lib/finanzas/reglas.js` (funciones puras, sin datos ni reloj). La app aplica hoy las mismas fórmulas dentro de `app.js`; las pruebas de paridad (`tests/logica/paridad.js`) comparan ambas en cada ejecución.

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

## Discrepancias encontradas
| # | Hallazgo | Impacto | Propuesta | Estado |
|---|---|---|---|---|
| D1 | `today()` usa la zona horaria del dispositivo, no `America/Santo_Domingo` | Un dispositivo en otra zona puede adelantar o atrasar «hoy» (cortes, vencimientos) | Reemplazar por `hoy()` de la capa pura | **Requiere tu decisión** (cambia el reloj global) |
| D2 | `certProjection` recalcula con la tasa y retención actuales del certificado: editar la tasa cambia el interés de periodos pasados | Rompe «el pasado no se modifica» | Guardar vigencias de tasa/retención e instantánea al crear y al cobrar; calcular periodos futuros con la regla nueva | Modelo y migración listos; **falta conectar la pantalla** |
| D3 | `fx` y los beneficios convierten con la tasa vigente; solo los totales mensuales usan la tasa guardada. La carga rellena `fxRateSnapshot` de movimientos antiguos con la tasa actual | Los totales en RD$ de movimientos en US$ cambian si cambia la tasa; no hay fuente ni fecha de la tasa | Usar siempre la tasa guardada; guardar fuente y fecha de la tasa; marcar los rellenados como «estimados» | **Requiere tu decisión** |
| D4 | La tasa anual de la tarjeta (RD$ y US$) solo se guarda y se muestra; no se calcula interés por saldo | Los «intereses» de tarjeta no se reflejan en saldos | Decidir si debe calcularse (método: saldo medio diario o saldo facturado) | **Requiere tu decisión** |
| D5 | El pago mínimo es porcentaje simple sin piso | Un banco real suele fijar un mínimo absoluto | Añadir piso como regla con vigencia | Pendiente de decisión |
| D6 | Préstamo: ya existe una vigencia parcial de tasa (`rateEffectiveFrom`) y de cuota, pero con solo dos niveles (tasa inicial y vigente) | Un tercer cambio de tasa sobrescribe el anterior | Migrar a lista de vigencias | Pendiente |
| D7 | Existen dos funciones de redondeo idénticas (`rnd`, `v900Round`) | Riesgo de divergencia futura | Unificar en `rnd` | Marcada; sin cambios hasta confirmar |
| D8 | El interés del préstamo se redondea por periodo y el total difiere en centavos de un cálculo sin redondeo intermedio | Diferencias de centavos frente al estado del banco | Mantener (es lo que se cobra); documentado | Sin acción |
