# Cambios a la lógica

| Fecha | Cambio | Motivo | Impacto |
|---|---|---|---|
| 2026-11-15 | Se agrega `lib/finanzas/reglas.js` (capa de cálculo puro y vigencias) | Centralizar fórmulas y poder probarlas | Ninguno en la app: todavía no se usa en pantalla |
| 2026-11-15 | Se agregan `tests/logica/` (10 pruebas unitarias y 256 comprobaciones de paridad con la app) | Verificar fórmulas, historial, consistencia e idempotencia | Ninguno |
| 2026-11-15 | `tests/harness.js` expone funciones internas solo para pruebas | Poder comparar la app con la capa pura | Solo pruebas |
| 2026-11-15 | Migración `20261115000000_reglas_vigentes_y_instantaneas` y su reversión | Guardar vigencias e instantáneas sin reescribir historial | Sin aplicar a producción; probada en una base local de pruebas |

| 2026-11-15 | `today()` usa `America/Santo_Domingo` | D1: el reloj no debe depender del dispositivo | Sin cambio para usuarios en esa zona; en otra zona la fecha de «hoy» puede diferir hasta un día |
| 2026-11-15 | `v900Round` delega en `rnd` | D7: una sola regla de redondeo | Resultados idénticos |
| 2026-11-15 | Certificados: vigencias de tasa y retención; cálculo por tramos; instantánea al crear | D2: lo ya devengado no se recalcula | Certificados sin cambios de tasa dan exactamente el mismo resultado; los editados desde ahora conservan el interés anterior al cambio |
| 2026-11-15 | Beneficios, cashback, préstamos entre personas y certificados usan la tasa guardada con el movimiento | D3 | Totales en RD$ de movimientos en US$ con tasa guardada pueden diferir de los mostrados antes (antes usaban la tasa vigente) |
| 2026-11-15 | Préstamo: la tasa de cada periodo sale del historial de condiciones | D6 | Solo cambia préstamos con dos o más cambios de tasa registrados |
| 2026-11-15 | Tarjeta: campo «monto mínimo» del pago mínimo y vigencia por cambio | D5 | Vacío = sin cambio; los cortes anteriores conservan su mínimo |
| 2026-11-15 | Instantáneas al crear cuenta, tarjeta, certificado y préstamo | Historial de reglas y resultados | Datos nuevos (`ruleVersions`, `recordSnapshots`) que se sincronizan como las demás colecciones |
| 2026-11-15 | Detalle de tarjeta: el interés orientativo usa la capa pura | Centralizar fórmulas | Mismo valor |
| 2026-11-15 | Registro de auditoría (`auditLog`) en ediciones de cuenta, tarjeta, certificado y préstamo y en eliminaciones de movimientos | Saber quién, cuándo y el valor anterior | Datos nuevos sincronizados como las demás colecciones |
| 2026-11-15 | Cierre de sesión tras 30 minutos sin actividad | Seguridad de la sesión | No cierra con cambios sin sincronizar |
| 2026-11-15 | Captura global de errores y red con tiempo de espera y reintentos solo en lecturas | Resiliencia | Sin cambio visible |
| 2026-11-15 | Fondo de las ventanas de registro sin desenfoque; color de acento en Ingresos recurrentes | Pedido de diseño | Solo visual |
| 2026-11-15 | Tarjeta: límites, sobregiro, tasas, comisión por avance y anualidad con vigencia; historial visible en el detalle | Un cambio rige desde su fecha y no altera el pasado | El utilizado mensual histórico usa el límite vigente de cada mes; el estado actual usa el vigente hoy |
| 2026-11-15 | Vigencias: una corrección el mismo día agrega otro registro (gana el más reciente); fechas anteriores se rechazan | Poder corregir sin reescribir | La migración permite varias entradas por día; sigue sin permitir editar ni borrar |
| 2026-11-15 | Pruebas de recorrido (`tests/logica/recorrido-*.js`): todas las entradas de pago de tarjeta, préstamo y servicio, el menú Registrar y los selectores de beneficios y préstamos | Verificar que cada acceso apunta al formulario y a la tarjeta correctos | Solo pruebas |
| 2026-11-15 | Pago de tarjeta: se rechaza un pago mayor que la deuda; confirmación en web con la misma composición que en móvil | Evitar sobrepagos accidentales y desorden visual | Un pago mayor a la deuda ahora muestra aviso y no se registra |
| 2026-11-15 | Campo «Fecha en que la adquiriste (antigüedad)» en cuentas, tarjetas, préstamos y certificados; se muestra la antigüedad en años y meses | Pedido: conocer desde cuándo se tiene cada producto | Dato nuevo opcional; sin cambios de esquema; no altera cálculos |
| 2026-11-15 | Vive: filtro por tema, instante anterior, guardar y ver guardadas, copiar, deslizar y flechas, hoja opaca con el acento; si se agotan las combinaciones de un tema se reinicia la memoria | Hacer la opción más robusta y útil | Solo presentación; los datos se guardan en este dispositivo |
| 2026-11-15 | Pago recurrente en 3 pasos (Servicio, Programación, Confirmación) igual en móvil y web, con selector universal de cuenta o tarjeta; catálogo de iconos ampliado a más de 140 servicios propios y adivinanza por nombre | Pedido: nuevo diseño y más variedad de iconos | Mismos campos y guardado; la moneda se toma de la cuenta elegida |
| 2026-11-15 | Sistema universal de iconos en pagos recurrentes: catálogo, cualquier emoji (buscar o pegar), letras con color e imagen propia; validación estricta del formato | Pedido: el sistema de iconos más universal posible | Dato opcional; formatos emoji:X y mono:AB:#hex junto a los ids existentes |
