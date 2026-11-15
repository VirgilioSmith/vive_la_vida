# Registro universal · sistema visual base (V1110)

Fuente de verdad: las imágenes de referencia de móvil (Nueva tarjeta, Nueva cuenta, Nueva institución, Nuevo certificado, Nuevo préstamo). La web usa **los mismos componentes**, con el mismo aspecto, textos y estados; solo cambia el ancho útil del modal (máx. 560 px).

## Sistema visual extraído
| Elemento | Valor |
|---|---|
| Cabecera | flecha atrás (círculo 38 px, tinte del acento) · título centrado 19 px/800 · cerrar (círculo 38 px) |
| Etiqueta de campo | 12,5 px, peso 700, tinta `#1b2540`, sin mayúsculas |
| Campo / selector | alto 42 px, radio 12 px, borde `acento 14 %`, fondo blanco, texto 14,5 px |
| Selector de institución | alto 46 px, logo 30 px + nombre + chevron; lista con ✓ en la seleccionada |
| Segmentado (DOP/USD) | contenedor blanco con borde, botón activo con degradado del acento |
| Tarjetas de opción (radio) | radio 18 px, activa con fondo/borde del acento |
| Secciones (Límites, Tasas, Ciclo) | tarjeta radio 16 px con icono del acento + título 15 px/800 |
| Confirmación | título 23 px/800, tarjeta-resumen con logo 48 px, filas «Etiqueta · Valor · ✎ Editar», nota informativa con icono |
| Botón principal | alto 48 px, radio 14 px, degradado del acento, ancho completo (Continuar → / Crear …) |
| Pasos | círculos numerados con línea (certificado), píldoras (préstamo); hecho = ✓ |
| Colores | siempre derivados de `--v424-accent-strong`; modo oscuro con variables propias |

## Mapeo imagen → código
| Imagen | Código (`app.js`, bloque V1110) |
|---|---|
| Selector de institución («Popular ›») | `v1110BankPicker` (lista nativa `bankId` oculta como fuente del valor) |
| Campo universal (texto, monto, fecha, selección) | `v1110Field` (+ prefijo `RD$`/`US$` o sufijo `%`) |
| DOP · USD | `v1110Seg` |
| Ya constituido / Pendiente | `v1110Choice` |
| Día de corte / pago | `v1110Day` (el campo numérico original sigue siendo la fuente) |
| Secciones con icono | `v1110Sec` |
| Confirmación con «Editar» | `v1110Hero`, `v1110Rows`, `v1110Note`, `V1110.<form>.confirm` |
| Motor de pasos | `v1110Enhance` (cuenta, tarjeta, institución, certificado) · `v1110Loan` (préstamo, conserva su asistente v83/v87) |
| Estilos | `styles.css`, bloques «V1110» |

## Adiciones respecto a la imagen (mismo sistema visual)
- **Datos adicionales / Más opciones** (plegables): últimos 4 dígitos, interés de cuenta, deudas iniciales, sobregiro, pago mínimo, renovación de anualidad, nota de institución. Existían en los formularios; se conservan para no eliminar funciones.
- **Moneda de la anualidad** (tarjeta): el selector acompaña al importe, como en la imagen.
- Edición: el título pasa a «Editar …» y el botón final a «Guardar cambios».
- Préstamo: el paso 3 mantiene su resumen completo (12 filas) en lugar de las 8 filas de la imagen, porque incluye seguro, cargos y conciliación.

## Estado por elemento
| Elemento | Móvil | Web |
|---|---|---|
| Cabecera (atrás, título, cerrar) | igual | igual |
| Selector universal de institución | igual | igual |
| Campos universales | igual | igual |
| Nueva cuenta (2 pasos) | igual | igual |
| Nueva tarjeta (2 pasos) | igual | igual (ancho 560 px) |
| Nueva institución (2 pasos) | igual (colores: 10 + personalizado) | igual |
| Nuevo certificado (3 pasos) | igual | igual |
| Nuevo préstamo (3 pasos) | adaptado (resumen ampliado) | adaptado |
| Logo de institución en la confirmación | igual (logo real o iniciales) | igual |
| Marca de red (VISA / otra) | adaptado: «VISA» tipográfico; otras redes, nombre en texto | adaptado |
| «Datos de ejemplo» | no aplica (es de la maqueta) | no aplica |
| Textos con tildes, ñ, ¿ ¡ | verificado | verificado |

## Verificación
Recorrido de punta a punta (crear y editar) con `node` + Playwright en 390×844 y 1440×900: cuenta, tarjeta, institución, certificado y préstamo se guardan; sin banco, «Continuar» se bloquea con aviso; 0 errores de consola; `tests/smoke.js` sin hallazgos. La validación de entrada, el escapado de salida (`sanitize`) y el guardado original (`submit` de cada formulario) no se modificaron.

## Ajustes V1113 (comparación fila por fila con las imágenes)
- Campos numéricos con formato visible como en la imagen («RD$25,000.00», «RD$ 400,000», «60%», «8%»); el campo numérico real sigue siendo la fuente del valor (`v1110Twin`).
- Encabezados de paso: «Datos del certificado», «Condiciones del certificado», «Datos del contrato», «Capital y cuotas», «Confirma tu préstamo».
- Préstamo: moneda DOP/USD, modalidad Fija/Variable, ¿Incluye seguro? como interruptor (por defecto «No»), «Estado del préstamo» con «✓ Nuevo | Ya iniciado», «Cuota exacta» con «0 = calcular», y confirmación con tarjeta-resumen y filas «Editar».
- Institución: color ciruela primero y seleccionado por defecto; 7 colores en una fila; divisor entre logo y nombre en la vista previa.

## Pendiente
- Selectores de fecha: usan el formato del dispositivo, no se puede forzar dd/mm/aaaa.
- Marca de red con logotipos (Visa/Mastercard) como imagen.
- Contraste y accesibilidad de teclado en el selector (probados: Esc cierra, Enter avanza).

## Pantalla → implementación (todas en `app.js` bloque V1110 y `styles.css` bloques V1110–V1113)
| Imagen | Pantallas | Implementación |
|---|---|---|
| Nueva tarjeta | Datos · Confirmación | `V1110.cardForm` (`build`, `confirm`), formulario original `cardForm` (app.js ~3866) |
| Nueva cuenta | Datos · Confirmación | `V1110.accountForm`, formulario original `accountForm` (~3807) |
| Nueva institución | Datos · Confirmación | `V1110.bankForm`, formulario original `bankForm` (~1329) |
| Nuevo certificado | Datos y capital · Condiciones · Confirmación | `V1110.certificateForm`, original `certificateForm` (~3873) |
| Nuevo préstamo | Contrato · Capital y cuotas · Confirmación | `v1110Loan` sobre el asistente v83/v87 de `loanForm` (~3978) |
