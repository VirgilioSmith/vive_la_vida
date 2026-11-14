# Avance · flujo del botón REGISTRAR

Registro de avance del flujo **Registrar** (web y móvil) y de la revisión posterior del resto de la app.
Cada entrada se añade al final; las anteriores no se borran.

Entorno de prueba: `index.html` servido en local, datos de demostración (`seedDemo`), Supabase simulado,
tema claro. Viewports: 360×800, 390×844, 375×667, 768×1024 (táctil emulado) y 1440×900 (web).
Teclado en pantalla simulado reduciendo `visualViewport` 336 px.
El proyecto es un único `index.html` estático: no hay paso de build; "build sin errores" = carga sin errores en consola.

---

## Paso 1 · Inventario del flujo REGISTRAR — 2026-11-14

**Estado:** inventario completo. Web: pendiente de corrección. Móvil: pendiente de corrección.

### Asistente Registrar (pestañas Recibir / Pagar / Mover / Otros)

| Elemento | Acción esperada | Acción actual | Problemas |
|---|---|---|---|
| Título "REGISTRAR" y X | Cerrar y liberar el fondo | Cierra; el fondo queda libre | Con la hoja abierta el fondo **sigue desplazándose** en móvil (sin bloqueo) |
| Pestañas Recibir/Pagar/Mover/Otros | Cambiar de grupo | Correcto | Texto de pestaña inactiva con contraste 3.9:1 (<4.5) |
| Otros → 4 operaciones | Abrir cada formulario | Correcto | Móvil: 1 columna, hoja alta; en 375×667 **scroll interno** (585/680 px) y bloque explicativo cortado |
| Bloque "Gestiones que completan tu registro" | Informativo | — | Ocupa ~100 px en móvil; en 375×667 no cabe |
| Modal web (1440×900) | Ajustado al contenido | Modal 830 px de alto con ~170 px vacíos abajo | "4 OPCIONES" descolocado al centro; bloque explicativo no alineado con la cuadrícula |
| Textos secundarios (#63758e) | Legibles | — | 4.29–4.32:1 en todas las pantallas (<4.5) |

### Gasto / Ingreso · móvil (pantalla "Nuevo movimiento" V749)

| Elemento | Acción esperada | Acción actual | Problemas |
|---|---|---|---|
| Tipo (Gasto/Ingreso/Transferencia) | Cambiar tipo | Correcto | — |
| Importe | Teclado decimal, campo legible | `inputmode="decimal"`, teclado integrado | Campo transparente sin borde (no cumple fondo blanco + borde) |
| Categorías rápidas + "Más" | Elegir categoría / abrir selector | Correcto (verificado por valor) | — |
| Subcategoría | Elegir exactamente la tocada | Correcto (por `data-value`) | No se puede elegir desde la entrada salvo vía "Más" |
| "Pagar con" (cuenta/tarjeta) | Abrir selector | Correcto | Área táctil 119×17 px |
| "Más operaciones" | Abrir menú | Correcto | Área táctil 149×35 px |
| Continuar | Ir a confirmación | Correcto | 375×667: teclado numérico cortado (scroll interno 463/493) |
| Impacto · "DÉFICIT RD$0.00" | Legible | — | Rosa sobre blanco 1.78:1 |
| Validación | Importe > 0, categoría | Mensaje bajo los botones | No acepta coma decimal (`applyKey` solo "."); mensaje lejos del campo |

### Confirmación (gasto/ingreso) · móvil

| Elemento | Acción esperada | Acción actual | Problemas |
|---|---|---|---|
| Categoría / Subcategoría | Abrir selector | Correcto | Filas de 28 px de alto (<44) |
| Fecha, Nota | Campos legibles | — | Transparentes sin borde |
| Nota con teclado | Visible | Visible (corrección V952) | 375×667 y 360×800: scroll interno |
| Confirmar | Guardar una vez | Correcto, bloqueo `confirmationBusy` | — |
| Editar | Volver sin guardar | Vuelve conservando datos | — |
| X | Cerrar sin guardar | Cierra, no guarda, el siguiente registro empieza limpio | — |

### Gasto / Ingreso · web (formulario `fastx` en 1440×900)

| Elemento | Acción esperada | Acción actual | Problemas |
|---|---|---|---|
| Layout | Cabe sin scroll | `fastx-body` con scroll 570/783 px | Bloque "Impacto del egreso" duplica el "Resumen en vivo" de la columna derecha |
| Importe | Acepta coma o punto | `type="number"` | No acepta coma; campo transparente |
| Selects / fecha / nota | Blanco, borde, texto negro | Fondo #fcfdff, texto #25415f | Texto no casi-negro |
| Textos | ≥4.5:1 | 27–33 textos por debajo | Etiquetas y descripciones gris claro (2.8–3.8:1) |
| Botones de categoría / pestañas | ≥44 px | 38–41 px | Área táctil pequeña |

**Consola:** sin errores ni warnings en ningún recorrido.

**Bugs abiertos:** todos los de las tablas anteriores.

**Próximo paso:** Paso 2 · gasto e ingreso (web y móvil).

---

## Paso 2 · Gasto e ingreso (web y móvil) — 2026-11-14

**Estado:** Web: terminado. Móvil: terminado.
Verificado en 360×800, 390×844, 375×667 (táctil, con y sin teclado) y 1440×900:
sin scroll de página ni interno, contraste ≥4.5:1, campos blancos con borde y texto casi negro,
áreas táctiles ≥44 px, sin errores en consola.

### Cambios (todos en `index.html`)

| Cambio | Motivo |
|---|---|
| Nuevo bloque `<style id="v953-registrar-finish">` con tokens `--v953-*` (tinta, texto secundario, borde, campo, peligro, área táctil, radio, espacio) | Base compartida de legibilidad y tamaños |
| Fondo bloqueado con `html:has(#modal-root>*)` | La página de detrás se desplazaba con la hoja/modal abierto; se libera al cerrar |
| Móvil: textos secundarios a `#45556e`, déficit a `#b42335`, botón morado un tono más profundo | Contraste <4.5:1 (déficit 1.78:1) |
| Móvil: importe, fecha y nota con fondo blanco, borde y texto casi negro; borde rojo si el importe es inválido | Estándar de campos |
| Móvil: "Más operaciones", "Pagar con", filas de Categoría/Subcategoría y Continuar a ≥44 px | Áreas táctiles de 17–35 px |
| Móvil ≤740 px de alto: sin subtítulo, "Más operaciones" en la fila del cerrar, panel de impacto compacto, teclado numérico a 44 px | En 375×667 no cabía (scroll 463/493) |
| Confirmación compacta (ilustración e impacto reducidos) | En 375×667 y 360×800 había scroll interno |
| `setError` (V749): el mensaje se coloca junto al campo (importe, categorías o cuenta) y marca `aria-invalid` | El mensaje salía lejos del campo |
| Importe móvil: la coma se convierte en punto | "12,50" se convertía en "1250" |
| Web: importe `type="text" inputmode="decimal"` con normalización coma→punto y `setCustomValidity` (>0 y vacío en español) | `type="number"` no aceptaba coma; la regla "mayor que cero" se conserva |
| Web: `<style id="v953-registrar-web">`: formulario en columna flex acotada, cabecera y bloques compactos, campos legibles, acento morado más profundo como texto, montos sin partir | Scroll interno 570/783 y pie empujado fuera; 27–33 textos con contraste bajo |
| Web (≤960 px de alto): se oculta la nota aclaratoria de "Impacto del egreso" (repetida en "Resumen en vivo") | Necesario para que quepa sin scroll |
| Web: aviso "Gasto/Ingreso registrado" tras guardar, solo si el formulario se cerró y hay un movimiento nuevo | En web no había confirmación visible |

### Verificado
- Gasto e ingreso móvil y web: registro completo, categoría/subcategoría por valor, "12,5" → 12.5, "85,75" → 85.75.
- Validación: importe vacío/0 bloquea con mensaje junto al campo; categoría obligatoria (regla existente).
- Doble clic en Registrar: un solo movimiento. Botón en "Guardando…" (móvil) / modal cerrado (web).
- Cerrar/X y Editar no guardan; al reabrir el formulario está limpio; el fondo se libera.

**Bugs abiertos:** subcategoría obligatoria (pendiente de decisión, ver abajo).

**Pendiente de decisión:** la app ofrece "Sin subcategoría" como opción válida; hacer obligatoria la subcategoría
cambiaría esa regla. No se ha implementado.

**Próximo paso:** Paso 3 · gestiones avanzadas (hoja móvil y modal web).

---

## Paso 3 · Gestiones avanzadas (Recibir / Pagar / Mover / Otros) — 2026-11-14

**Estado:** Web: terminado. Móvil: terminado, con una excepción reportada (paso "Desglose" del préstamo en 375×667).

### Cambios (todos en `index.html`)

| Cambio | Motivo |
|---|---|
| `<style id="v953-registrar-assistant">`: pestañas de 72 px iguales en web y móvil, sin cortes de texto | Alturas distintas (71/76 px) |
| Móvil: hoja dimensionada por contenido, cabecera bajo `env(safe-area-inset-top)`, "Otros" en cuadrícula de 2 columnas con tarjetas compactas, bloque explicativo reducido a su título | En 375×667 la hoja tenía scroll (585/680) y el bloque quedaba cortado |
| Web: modal ajustado al contenido (máx. 900 px de ancho y 90dvh de alto), bloque explicativo alineado y de la misma altura que la cuadrícula | Espacio vacío abajo y bloque desalineado |
| Volver a REGISTRAR (`v953BackToRegistrar`): cada operación recuerda su pestaña; botón "Volver a Registrar" en Gasto/Ingreso/Transferencia y Pagar servicio; "Regresar" de Pagar tarjeta (paso 1) vuelve al asistente en lugar de cerrar todo | Volver no existía o cerraba todo |
| `<style id="v953-operation-forms">`: acento `--v953-accent` = paleta del usuario 16 % más profunda (no un color fijo), campos blancos con borde, textos secundarios legibles, áreas táctiles ≥44 px | Contrastes de 3.1–4.4:1, campos transparentes, objetivos de 27–40 px |
| JS: los campos con estilos en línea de V790 (fondo transparente `!important`) pasan a blanco con borde en tema claro | Las hojas de estilo no pueden superar estilos en línea `!important` |
| Títulos de Beneficios/Préstamo alineados a la izquierda; prefijo RD$/US$ por encima del campo blanco | Título alineado a la derecha y pegado al borde (captura del usuario) |
| Pagar tarjeta en web: orden de campos, icono del título y tarjeta de monto como en móvil; modal por contenido | Icono SVG de 566 px y campos fuera de pantalla (fallo previo) |
| Préstamo: el asistente de 3 pasos (V83) también en web; cabecera "volver + título" en una fila; "Desglose" en filas etiqueta/campo | En web los 3 pasos se apilaban (1584 px con scroll); "Desglose" con scroll |
| Pantallas ≤700 px de alto: se ocultan los bloques de **vista previa** (solo informativos) de Devolución, Conciliar, Beneficios y el desglose del paso 1 del préstamo (repetido en el paso 2) | Para caber sin scroll con áreas táctiles de 44 px |

### Verificado
- Las 8 operaciones abren su formulario; volver regresa con la pestaña conservada (Otros/Pagar/Recibir).
- X del asistente cierra y libera el fondo (sin errores en consola).
- Abonar a un préstamo completo en web y móvil: 4 → 5 pagos.
- Sin scroll ni contraste bajo en 390×844 y 1440×900 para Devolución, Conciliar, Beneficios, Préstamo, Servicio y Pagar tarjeta; en 375×667 todos excepto "Desglose".

**Bugs abiertos:**
- Préstamo · "Desglose" en 375×667: scroll interno limitado al contenido del paso (7 campos editables + 2 secciones opcionales no caben en 580 px).
- Préstamo · el capital aparece como `7585.960000000001` (residuo de coma flotante del cálculo). No se redondea para no alterar el dato guardado.

**Próximo paso:** Paso 4 · resto de la app.

---

## Paso 4 · Resto de la app — 2026-11-14

**Estado:** Pagos y avance: terminado en móvil (390×844) y web. Páginas generales: pendiente (reportado).

### Cambios (todos en `index.html`)

| Cambio | Motivo |
|---|---|
| Confirmar pago de servicio (móvil): pantalla completa, volver bajo la barra de estado, botón fijo abajo con zona segura, identidad del servicio en una fila, bloques sin compresión (`flex-shrink:0`) | Era hoja de 780 px con scroll 581/935; elementos solapados |
| Se oculta el resumen «Servicio · Vencimiento · Moneda» (repite nombre, «En N días» y prefijo RD$) | A pedido del usuario; antes quedaba aplastado a 28 px |
| Montos largos (`#v917ServiceTotal`, totales de tarjeta) sin cortes ni saltos de línea | Montos tipo RD$33,427.74 completos |
| Pagar tarjeta y Avance de efectivo (móvil): hoja inferior coherente apoyada sobre la barra de navegación (hueco de 76 px), por contenido, esquinas 28 px, pie integrado sin bloque blanco | A pedido del usuario: «desde abajo, reducido, coherente» |
| Icono decorativo arriba a la derecha en Pagar tarjeta (tarjeta) y Confirmar pago (comprobante), con el estilo del de Avance | A pedido del usuario |
| Confirmar pago de tarjeta compacto (cabecera en una fila, detalle con filas bajas) | Scroll 746/758 |
| Avance de efectivo: modal hasta el final del contenido; Fecha dentro de su columna; volver y botones a 44 px | Bloque blanco de ~120 px bajo los botones |
| `<style id="v953-app-legibility">`: pestañas internas inactivas y subtítulo/fecha de cabecera más oscuros | 2.7–3.3:1 |

### Verificado
- Pago de servicio, pago de tarjeta (22 → 23 pagos) y avance de efectivo (card_advance RD$5,325) se registran; consola sin errores.
- 390×844: Servicio, Tarjeta (pasos 1 y 3) y Avance sin scroll; hojas terminan en y=768, barra en 777.

**Bugs abiertos:**
- 375×667: Confirmar pago de servicio (501/661), Confirmar pago de tarjeta (569/724) y Avance (462/546) mantienen scroll interno en el formulario; el botón principal sigue visible y fijo.
- Web: Confirmar pago de servicio (667/718) y de tarjeta (762/795) con scroll interno leve.
- Páginas (Inicio, Movimientos, Beneficios, Ajustes): tienen scroll de página por su volumen (Inicio = 8.9 pantallas en móvil); quedan 25–150 avisos de contraste por página (parte son falsos positivos de fondos translúcidos con desenfoque).
- Tema oscuro · Pagar tarjeta: la hoja aparece clara y el monto «Monto a pagar» no se ve (fallo previo, existe en la versión original).
- Importación de compras: no revisada (no se encontró el punto de entrada con los datos de demostración).

---

## Verificación final — 2026-11-14

- Asistente (4 pestañas) en 390×844, 375×667 y 1440×900: sin scroll, contraste correcto, sin errores de consola.
- Gasto e ingreso en 390×844, 375×667, 360×800 y 1440×900: sin scroll ni campos fuera de estándar.
- Confirmación con teclado abierto (390×844 y 375×667): botón Confirmar visible; Editar conserva datos; X no guarda.
- Tema oscuro: sin roturas nuevas en asistente, Conciliar y Gasto.
- No hay paso de build (proyecto estático); la app carga sin errores en consola.
- Sin commit ni push (a pedido del usuario).

**Estado REGISTRAR:** Web: terminado. Móvil: terminado salvo las excepciones de 375×667 indicadas.

---

## Ajuste · Títulos de Beneficios bancarios y Abonar a un préstamo — 2026-11-14

**Estado:** Web y móvil: terminado.
- Verificado en 390×844, 375×667 y 1440×900: ambos títulos alineados a la izquierda (`text-align:left`), sin pegarse al borde derecho.
- 375×667 · Beneficios: se elimina el recuadro vacío del icono (`.v864-hero-icon`) que quedaba al ocultar el icono en pantallas bajas; el título empieza en el borde izquierdo del contenido. Formulario sin scroll.

---

## Ajuste · Hojas inferiores, selector universal y zonas seguras (móvil) — 2026-11-14

**Estado:** Móvil: terminado (iPhone 15 y Pixel 7 emulados; 390×844 y 375×667). Web: sin cambios.

### Cambios (todos en `index.html`)

| Cambio | Motivo |
|---|---|
| Hoja inferior común (`--v953-sheet-gap: 6px`) para Registrar, Pagar tarjeta, **Confirmar pago** y Avance: pegada abajo con separación mínima, esquinas de 28px, por contenido, `padding-bottom: calc(16px + env(safe-area-inset-bottom))` | Pedido del usuario: «más para abajo», coherente; la confirmación no va a pantalla completa |
| Avance de efectivo compacto, sin bloque blanco ni scroll | Estaba arriba con mucho espacio en blanco |
| `<style id="v953-universal-selector">`: los campos Tarjeta / Pagar desde / Desde esta tarjeta / Recibir en esta cuenta usan el diseño de las filas del selector universal (fila blanca 21px, logo VISA azul / Mastercard, recuadro lila de cuenta) | «Se ve por fuera como por dentro» |
| Confirmar pago en pantallas bajas: etiquetas dentro de la fila, sin título «Detalle del pago», canal compacto | El botón quedaba recortado en iPhone 15 |
| `<style id="v953-mobile-safe-areas">`: menú flotante `left/right:12px`, `bottom: calc(env(safe-area-inset-bottom) + 8px)`, radio 20px, sombra suave, z-index 71 (bajo los modales); cabecera con `safe-area-inset-top`; contenido con `padding-bottom` ≥ menú + zona segura | Especificación técnica del usuario |

### Verificado
- iPhone 15 (393×659) y Pixel 7 (412×839): menú a 12px de los lados y 8px del borde; sin scroll horizontal; hojas a 6px del borde; CTA ≥44px visible; sin scroll en Registrar, Pagar tarjeta, Confirmar pago y Avance.
- `viewport-fit=cover` ya estaba en el meta viewport; en móvil no hay reglas con `100vh` (solo en escritorio ≥791px).
- `env(safe-area-*)` no se puede simular en el emulador de Chromium (vale 0); las reglas están aplicadas y se comprobaron por CSS.

**Bugs abiertos:** 360×640 (pantalla muy baja, fuera del rango pedido): Confirmar pago aún recorta ~17px de contenido.

---

## Ajuste · Pendientes de pantalla baja y emblema de cuenta — 2026-11-14

**Estado:** Móvil: terminado. Web: sin cambios.

| Cambio | Motivo |
|---|---|
| Confirmar pago: emblemas con proporción fija (tarjeta 54×44, cuenta 44×44; en pantallas ≤700px 46×38 y 38×38) y sin `transform: scale` | Otra regla forzaba 32px de alto: la cuenta se veía 50×32 (más ancha que alta) |
| Confirmar pago en pantallas ≤700px: filas, total, cabecera y detalle más compactos; datos de la tarjeta en una línea con «…» | En 360×640 se recortaban ~17px |

**Verificado:** 360×640, 393×659 (iPhone 15), 375×667, 390×844 y 412×915: formulario sin scroll, botón «Confirmar pago» de 55px completamente visible; Pagar tarjeta, Avance y el asistente sin scroll en 360×640; pago con tarjeta registrado (consola sin errores).

**Bugs abiertos:** ninguno nuevo.

---

## Ajuste · Hojas de las 4 operaciones, barra liquid glass y zonas seguras — 2026-11-14

**Estado:** Móvil: terminado. Web: sin cambios.

| Cambio (`index.html`, bloques `v954-safe-vars` y `v954-nav-and-sheets`) | Motivo |
|---|---|
| Zonas seguras como variables `--v954-safe-top/bottom` (una sola fuente `env()`), usadas por todos los bloques V953/V954 | Poder verificarlas en el emulador (Chromium no simula `env()`): se prueban con valores de iPhone (59/34 px) |
| Préstamo, Beneficios, Conciliar y Devolución: hoja inferior igual que Pagar tarjeta (pegada abajo a 6 px, esquinas 28 px, por contenido, fondo atenuado); la altura máxima descuenta la zona segura superior | En iPhone ocupaban toda la pantalla y el botón volver quedaba tapado por la barra de estado |
| Cabeceras de esas 4 operaciones: «volver» y título en una fila, sin icono decorativo ni subtítulo; cuerpos y pie compactos (botón 52–56 px) | Para caber sin scroll con la zona segura |
| Hoja «Motivo del ajuste» (Conciliar): lista legible y relleno inferior con zona segura | El texto de «Seleccionar motivo» era casi invisible |
| Barra de navegación: `--v340-nav-inset` pasa a `max(6px, safe-bottom − 20px)` (14 px en iPhone); los botones flotantes derivan de esa variable y quedan a 16 px de la barra (antes 1 px) | La barra estaba alta y pegada al botón «+» |
| Barra y botones flotantes «liquid glass» (claro y oscuro): vidrio translúcido con desenfoque, borde de luz, brillo superior y píldora de cristal en la pestaña activa | Pedido del usuario |

**Verificado** (zona segura simulada 59/34, 47/34, 24/0 y 0/0; 393×852, 390×844, 412×839, 375×667, 360×640): las 4 hojas sin scroll con volver y botón visibles; botón de confirmación probado en cada una: Préstamo 4→5 pagos, Beneficios y Conciliar registran, Devolución abre «Seleccionar compra» y registra; consola sin errores.

**Pendiente:** comprobar en un iPhone real la altura de la barra respecto al indicador de inicio (el emulador usa valores simulados).

**Nota de integración (2026-11-14):** al fusionar, `main` ya traía cambios propios del dueño del repositorio sobre la barra de navegación
(`--v367-dock-bottom`, degradado de acento en el «Liquid Glass» V250) y el espacio superior de cinco vistas. Se conservó su versión y se
retiraron de este cambio las reglas de posición/estilo de la barra y de los botones flotantes (`--v340-nav-inset`, cristal propio, FAB).
Quedan de este cambio: hojas de las 4 operaciones, hoja «Motivo del ajuste» y zonas seguras como variables.

---

## Ajuste · Barra de navegación «cristal» y Conciliar (Aumentar / Disminuir) — 2026-11-14

**Estado:** Móvil: terminado. Web: sin cambios.

| Cambio (`index.html`) | Motivo |
|---|---|
| `<style id="v955-dock-glass">`: barra de navegación de cristal (desenfoque `max(22px, --v250-dock-blur)` + saturación, borde de luz, brillo especular, píldora de cristal en la pestaña activa) en claro y oscuro; botones flotantes del mismo material. Conserva la posición del propietario (`--v367-dock-bottom`) y su degradado de acento | Pedido del usuario; se monta sobre `main` sin pisar su posición |
| Conciliar un saldo: la dirección Aumentar/Disminuir se recuerda aunque el importe esté vacío, y un importe tecleado con «Disminuir» activo se guarda negativo (`adjustmentEnhancement`) | Con el importe vacío, «Disminuir» se perdía (el signo solo vivía en el signo del importe) y al teclear quedaba positivo. El valor guardado no cambia: positivo aumenta, negativo disminuye |

**Verificado:** 5 botones de la barra navegan y marcan su pestaña; Conciliar: Disminuir con importe vacío → −250 registrado; Aumentar → +90 registrado; Disminuir→Aumentar→teclear → positivo; las 4 hojas y sus botones de confirmación siguen funcionando; consola sin errores.

---

## Ajuste · Categorías rápidas: iconos y selección — 2026-11-14

**Estado:** Móvil: terminado. Web: sin cambios.

| Cambio (`index.html`) | Motivo |
|---|---|
| Iconos de categoría del sistema de la app (`V255_TAXONOMY` → `icon()` SVG) en los 3 chips, «Más», hoja de categorías y de subcategorías (`catIcon`, `moreIcon`); mismo color que las etiquetas de categoría | Los chips usaban emojis (`pict`), distintos al resto de la app |
| `chooseCategory`: tocar un chip solo marca `aria-pressed` y limpia el error; ya no se redibuja la pantalla (antes: capa nueva + animación `v789-arrive` = «flashback») | Bug de selección en gasto e ingreso |
| `renderEntry`: si la pantalla ya estaba abierta, el redibujo no repite la animación de entrada (`v956-no-anim`) | Al volver de la hoja de subcategorías |
| Buscador de las hojas de categoría: campo blanco con borde y texto casi negro (tema claro) | Estándar de campos |

**Verificado** (gasto e ingreso, 393×852 con zona segura, 375×667): tocar chips → 0 capas nuevas y 0 animaciones en marcha; «Más» → categoría → subcategoría → importe → Continuar → Confirmar guarda la categoría y subcategoría elegidas; teclado abierto: hojas por encima; consola sin errores.

---

## Ajuste · Subcategorías en la pantalla de entrada — 2026-11-14

**Estado:** Móvil: terminado. Web: sin cambios.

| Cambio (`index.html`) | Motivo |
|---|---|
| Fila de subcategorías bajo la de categorías (`subQuick`, `quickStack`): las 3 subcategorías más usadas de la categoría + «Más», con los mismos chips, iconos (`catIcon` con la subcategoría) y alineación (grid de 4) | Pedido del usuario: elegir subcategoría directamente, como las categorías |
| `chooseSub`: tocar una subcategoría solo la marca (tocarla otra vez la quita = sin subcategoría); `chooseCategory` reemplaza la fila de subcategorías en el lugar, sin redibujar | Sin «flashback» |
| La categoría elegida desde «Más» queda visible y marcada en la fila (reemplaza la 3.ª); ya no se abre otra hoja detrás: se vuelve a la pantalla con sus subcategorías | «Selecciona únicamente eso, no hace más nada» |
| Pantallas ≤700px de alto: teclado 36px, chips 42px, iconos 19px | Para que quepa sin scroll con la fila nueva (375×667 y 360×640) |

**Verificado:** gasto e ingreso: tocar subcategoría (0 capas nuevas), quitarla, cambiar de categoría (la fila cambia en el lugar), «Más» categorías → categoría marcada con sus subcategorías, «Más» subcategorías → hoja → queda marcada, Continuar y Confirmar guardan categoría/subcategoría; 393×852, 390×844, 375×667 y 360×640 sin scroll; hoja de subcategorías sobre el teclado; consola sin errores. En 320×568 (fuera del rango 360–430) queda scroll interno.

**Ajuste posterior (misma fecha):** cada fila de selección tiene siempre cuatro botones (hasta 3 opciones + «Más», «Más» en la 4.ª columna). En la fila de subcategorías «Más» ya no desaparece con ≤3 subcategorías (antes faltaba, p. ej. en Inversiones) y, con menos de 3, se añaden huecos invisibles (`v956-slot`) para mantener la alineación (p. ej. «Otros gastos»). Verificado en las 28 categorías (19 gasto + 9 ingreso). En pantallas ≤700px chips y línea «Pagar con» a 44px (sin scroll en 375×667 y 360×640).

---

## Decisión final · Categorías rápidas — 2026-11-14

Por indicación del usuario: la selección de categoría son **exactamente cuatro botones (3 categorías + «Más»), nada más**. Se retiró la fila de subcategorías de la pantalla de entrada y la sustitución del tercer chip. Las subcategorías se eligen como siempre: «Más» → categoría → hoja de subcategorías (o desde la confirmación).
Se mantienen los iconos de categoría del sistema de la app (V255), ahora **en el color de acento** elegido en Ajustes (claro y oscuro), la selección sin «flashback» y el buscador legible.

## V957 · KPI grande de Bancos con el acento configurado
- Instituciones, Cuentas, Tarjetas, Préstamos, Certificados y Beneficios (web y móvil, claro y black) usan ahora el mismo degradado del acento (`--v440-*`) con texto blanco.
- Antes: web con degradados fijos (teal/azul/morado/café) y móvil con tarjeta blanca (Bancos), lavada (Cuentas) o mezclas fijas (Préstamos/Certificados).
- Sin cambios en cálculos, datos ni reglas. Botones del hero conservan su estilo (claro / contorno).

## V959 · Wallet móvil y capacidad de endeudamiento dinámica
- Wallet móvil: acordeones («Cortes por moneda», «Avance de efectivo») alineados a la misma línea izquierda que los títulos de los paneles; separación uniforme de 14px entre píldoras (antes ~48px); «Cortes por moneda» ya no parte en dos líneas.
- Capacidad de endeudamiento (mes en curso): ahora compara lo **pendiente por pagar** con (**ingresos por cobrar** + **dinero disponible hoy** en cuentas corrientes y efectivo; los ahorros no cuentan). Lo ya cobrado/pagado no se cuenta dos veces. Meses pasados/futuros conservan el cálculo mensual completo. El desglose muestra ambos lados y la referencia mensual completa.

## V960 · Color de la categoría Platinum
- Platinum es ahora gris plata neutro (`--v960-platinum`) en todas las vistas de tarjeta: web (lista de Tarjetas), Wallet móvil (tarjeta grande y miniaturas) y selector de pago. Antes: azul pizarra en Wallet móvil y azul marino fijo en el selector de pago (que pintaba todas las categorías igual).
- `cardTierKey`: si la tarjeta está guardada como «Clásica»/«Otra» (valor por defecto del formulario) pero su nombre/categoría dice Platinum, Gold, Black…, manda el nombre.

## V961 · Hueco bajo la cabecera, mini-KPI de Bancos y capacidad con ingresos adicionales
- Todas las páginas que no eran Bancos/Wallet/Inicio sumaban otra vez la zona segura superior (ya reservada por `.shell`), dejando ~60px de hueco bajo la cabecera en iPhone. Corregido: todas arrancan a la misma altura. (El simulador no reproducía `env()`; ahora emula `.shell` con la zona segura.)
- Hero móvil de Bancos: «Deudas» y «Posición neta» ahora son mosaicos redondeados con relleno (antes cajas cuadradas con texto pegado al borde).
- Capacidad de endeudamiento: se suman explícitamente los ingresos adicionales del mes (extras laborales y otros ingresos no programados); los depositados en ahorros se incluyen aparte para no perderlos. Se muestran en el desglose.

## V962 · Se retira la suma de ingresos adicionales en la capacidad de endeudamiento
- A petición del usuario: sumar aparte los ingresos adicionales podía contar dos veces el dinero (al registrar un ingreso y pagar un compromiso). Se vuelve al cálculo de V959: pendiente por pagar ÷ (por cobrar + disponible hoy en cuentas corrientes y efectivo).

## V963 · Préstamos móvil: coherencia visual
- Detalle del préstamo: tonos terracota (botones, etiquetas, pestaña activa, columna «Con estrategia») → acento configurado. Botones secundarios con contorno de acento.
- Acciones de cabecera ordenadas: «Registrar cuota» ancho completo, «Editar ficha»/«Cancelar» en pareja y «Abono extraordinario» ancho completo (antes texto partido en dos líneas).
- Comparativa de escenarios: columnas con ancho real (las cifras ya no se montan); desplaza solo dentro de su tarjeta.
- Acción principal de Cuentas/Préstamos/Tarjetas (`v239-action-primary`): del azul suelto al acento.
- Hero v239: cifras secundarias en una línea (ya no parten «14 nov de 2026» ni los montos largos).

## Auditoría · Avance de efectivo (sin cambios de código)
- Con un avance de RD$10,000 (comisión 3%): Egresos del mes sube solo RD$300 (comisión, en «Deudas e intereses»); ingresos no cambian; la deuda de la tarjeta sube RD$10,300; el efectivo recibido entra a la cuenta. El principal no cuenta como gasto (igual que el pago de tarjeta).

## V964 · Wallet móvil: «Crédito disponible» y «Deuda utilizada» alineados
- Etiqueta, cifra, equivalencia y desglose por moneda comparten ahora las mismas líneas en ambas columnas (la deuda tenía 19px de relleno superior y tipografías distintas). Verificado a 360/390/430px.

## V965 · KPI «Original móvil» eliminado y Avance de efectivo validado
- Se elimina la opción «Original móvil» del selector de KPI (Explorar → Personalizar). Quedan tres estilos (Tres círculos, Creativo, Balance y posición neta). Balance y posición neta es ahora el estándar: quien tuviera «original» (o ninguno) lo ve automáticamente; quien eligió otro estilo lo conserva.
- Se quita la línea divisoria horizontal del KPI «Balance y posición neta» (la que cruzaba las barras) en la tarjeta real y en su miniatura.
- Avance de efectivo (validación completa): comisión = efectivo × %; deuda = efectivo + comisión; solo la comisión entra en Egresos («Deudas e intereses › Comisión de avance de efectivo»), convertida a RD$ si es US$. Probado: 0 % (sin comisión), 3.75 % de 1,234.56 → 46.30, US$200 al 5 % → US$10 (RD$600), 101 % rechazado. Corrección: la comisión ahora aparece también como renglón en el análisis de Egresos (estaba en los totales pero no en el listado).

## V966 · Botones Recibir / Gastar / Transferir (Resumen móvil)
- Botones de cristal de 48px, radio 16, icono en mosaico de acento, texto 12.5px/740, estado táctil y foco visible; variante Black. Sin recortes de texto de 344px en adelante (los más estrechos reducen icono y tipografía).

## V967 · KPI Balance premium y botones rayados
- KPI «Balance y posición neta»: sin iconos ni rótulos bajo las cifras (quedan como texto oculto para lectores de pantalla); barra verde (Fondos) y roja (Deudas) a su lado; cifras en grafito; fila subida ~8px para no pegar con el borde inferior; barras decorativas en el acento.
- Botones Recibir/Gastar/Transferir: sin sombra exterior; efecto solo interior, tipo cepillado/rayado diagonal en el color del acento (versión grafito en Black).

## V968 · KPI Balance: color en la cifra, rótulos de vuelta
- Se revierte el diseño con barras (V967): vuelven las palabras «Fondos» y «Deudas» bajo las cifras; sin iconos ni rayitas.
- El color va en la cifra: Fondos en verde, Deudas en rojo. La cifra principal es grafito si el patrimonio es positivo y rojo si es negativo. La fila se mantiene elevada (~8px) para no rozar el borde inferior.

## V969 · Vive (frases), Apple Pay y barra de estado
- **Vive — validación:** el motor anterior tenía solo 81 frases fijas + 10 palabras sueltas y 6 mantras que salían ~14 % de las veces («Vive.», «Respira.», «Agradece.»…); no existía ningún generador de millones de combinaciones, por eso se repetía tanto. Ahora cada texto se arma con apertura (30) · verbo+objeto por tema (12 temas) · matiz (24) · cierre (24): **≈16.3 millones de combinaciones** (`ViveModule.stats()`). Las palabras (p. ej. «Dios») pueden repetirse, pero en contextos distintos; no se repite ninguna combinación exacta (se recuerda en el dispositivo, hasta 4,000) y se evitan aperturas, matices, cierres, verbos y objetos recientes y el mismo tema seguido. Prueba: 3,000 lecturas → 3,000 únicas, 0 finales repetidos consecutivos. Se retiran las palabras sueltas y mantras.
- **Apple Pay (Configuración):** «Actividad reciente» muestra solo los 3 eventos más recientes («Últimos 3 de N»).
- **Barra de estado / isla dinámica:** el contenido que se desplaza por debajo queda velado y desenfocado (nunca legible detrás de la hora o la isla).

## V970 · Botones Recibir / Gastar / Transferir, versión limpia
- Se retira el rayado: botones planos de cristal claro, borde fino, texto en grafito y solo el icono (sin mosaico) en el acento. Sin sombras ni efectos. Versión Black en grafito oscuro. Verificado sin recortes de 320 a 430px.

## V971 · Buscador móvil sin icono de cuatro cuadros
- Se elimina el icono de cuadrícula (4 cuadritos) del campo de búsqueda de Buscar; el campo gana ancho y el marcador se acorta a «Bancos, tarjetas, servicios…» para que no se corte.

## V972 · Formularios de alta móviles (Institución, Cuenta, Tarjeta, Préstamo, Certificado)
- Misma familia visual que las hojas de Registrar: cabecera limpia con cierre redondo en acento; tarjeta de contexto en el degradado del acento con icono propio de cada formulario (banco, cartera, tarjeta, recibo, gráfico) y su descripción; campos uniformes (48px, enfoque con aro de acento, 16px para no hacer zoom en iOS); pie de acciones a ancho completo pegado abajo con zona segura.
- Botón principal en el acento (antes verde en Institución/Cuenta/Certificado y azul en el asistente de Préstamo); Cancelar como botón de contorno.
- Se eliminan las barras en blanco (contenedores vacíos `v384-intro`, `v385-cert-intro`, vista previa vacía) y el recuadro blanco inset bajo el pie.
- Préstamo: «Siguiente» ya no flota sobre los campos; pasos y numeración en el acento; cabecera de paso en degradado.
- Variante Black completa. Verificado a 360/390/430px y con acentos coral, esmeralda y original. Sin cambios de lógica ni de guardado.

## V973 · Explorar refinado y barra de navegación con halo de acento
- Explorar (móvil): título más contundente, fecha con chevron a la derecha del título y subtítulo debajo; paneles de cristal más redondeados; etiquetas «TU ACTIVIDAD / TU VISIÓN» en el acento con su icono (barras / ojo); fichas con relieve suave, iconos con luz interior y flechas en círculo de acento. Variante Black incluida.
- Barra de navegación: la tinta que era grafito pasa al color del acento (inactivos mezclados con grafito para legibilidad, activo en acento pleno); halo de acento bajo la barra y píldora activa de cristal con resplandor del acento.

## V974 · Configuración (web) sin desplazamiento y alineada
- Apariencia: las cuatro opciones (Tema · Acento · Fondo · Navegación) pasan a pestañas de cristal con el estilo de la barra de navegación (píldora activa con halo del acento); cada una cabe sin desplazar la página.
- La página de Configuración ocupa exactamente la ventana: el menú lateral y el panel de opciones comparten borde superior e inferior (verificado a 1280×720, 1366×768, 1440×900 y 1920×1080). Otros paneles largos (p. ej. Integraciones) se desplazan dentro de su propio panel, no la página.
- Cabecera con etiqueta y título pesados (11px/900, 36px/900) en el acento; menú lateral compacto con etiquetas de grupo en el acento y elemento activo con el estilo de la barra de navegación. Variante Black.
- Explorar móvil: se quita «Organiza y potencia tu espacio financiero.» y las descripciones de panel para subir el contenido.

## V976 · Ajustes (web): ningún panel obliga a desplazar
- Además de Apariencia, los paneles largos se reparten en pestañas con el mismo estilo: Integraciones (Vincular · Guía · Conexiones) y Configuración financiera (Cambio · Cargos · Nómina). Cuentas vinculadas pasa a una cuadrícula de 2 columnas con paginación (‹ 1–4 de 10 ›). Verificado a 1440×900: los 8 paneles caben sin barra de desplazamiento (ni de página ni interna).
- En pantallas de 768px de alto o menos, algunos paneles conservan un desplazamiento interno mínimo.
- Hallazgo (sin cambiar): en la sección Seguridad, `v401FinancialLogicAudit` (script aparte) usa `db`, que está dentro del scope del script principal; en pruebas lanza «db is not defined» y se muestra «No fue posible cargar esta sección».

## V977 · Suscripciones (móvil)
- Título «Suscripciones» legible (estaba en blanco sobre fondo claro); tarjetas superiores con el degradado del acento configurado (antes azul fijo); las marcas del cuadro derecho van en una cuadrícula 2×2 centrada (máx. 4) sobre círculos blancos, con el recuento («N Activas») abajo.

## V978 · Barra de navegación según la referencia del usuario
- Placa lavanda casi plana sin borde visible, tinta azul noche en inactivos (iconos y texto), píldora activa clara con resplandor del acento debajo, sin punto indicador; iconos de trazo más fino. Solo tema claro; el tema Black conserva su versión.

## V979 · Restos del acento anterior
- Etiqueta superior de cada título («titulito»: PATRIMONIO · EVOLUCIÓN, CONTROL DEL MES, VENCIMIENTOS…, también web y personalización): siempre en el color del acento (claro y Black). Se excluyen las etiquetas sobre tarjetas de acento (blancas) y las etiquetas de métricas (UTILIZADO, SALDO DISPONIBLE…).
- Explorar: fichas azul/violeta → acento (icono, flecha, barras de «Visión global», trazo de «Planificación», barra de «Presupuesto»); ingresos (verde) y egresos (rosa) se conservan por ser semánticos.
- Botón flotante de movimientos con el acento.

## V980 · Arranque: logotipo en el acento y disolución tipo «chasquido»
- Pantalla de inicio: «vive el hoy» toma el color del acento (se recuerda el último usado; en tema Black, una versión clara) y se elimina la barra de carga inferior.
- Al terminar de cargar, el logotipo se deshace en partículas (de izquierda a derecha) mientras el telón se aclara y deja ver la app ya renderizada (~1.5 s, no bloquea toques). Con «reducir movimiento» activado se retira directamente. Si algo falla, cae al cierre inmediato anterior.

## V981 · Disolución de página al navegar (móvil y web)
- Al cambiar de sección, el contenido saliente se deshace en polvo (filtro SVG de ruido + desplazamiento, ~0.95 s, desplazándose levemente hacia la derecha) mientras la página nueva aparece ya renderizada y sube suavemente. Se elimina el chasquido del dock y la barra lateral (fijos, no participan). No bloquea toques, respeta «reducir movimiento» y no altera datos ni lógica. Cambios dentro de la misma sección (filtros, pestañas) no disparan el efecto. Probado en 390×844 y 1440×900 con navegación rápida encadenada sin errores.

## V982 · Correcciones tras V981
- Se retira por completo la transición de página V981 (el polvo al cambiar de sección). El efecto de disolución queda solo en el arranque (V980).
- Barra de navegación: forma de píldora completa (extremos totalmente redondeados) y vuelve el cristal translúcido con desenfoque; píldora activa clara con resplandor del acento; Black sin cambios.
- Explorar: las flechas de las fichas pierden el círculo y el borde (queda solo la flecha en el acento).
- Configuración (web): las pestañas de Apariencia se estiraban a ~340px de alto en pantallas grandes (rejilla con filas elásticas); ahora toman su altura natural. Verificado a 1440×900 y 2000×1227.
- El nombre «vive el hoy» de la cabecera móvil va en el color del acento.

## V983 · Configuración compacta en pantallas grandes
- El menú lateral ya no reparte sus grupos por toda la altura (había huecos enormes en monitores grandes): grupos juntos arriba. La altura de la página de Configuración se limita a 791px, así menú y panel quedan alineados y compactos igual que en 1440×900. Verificado a 1440×900 y 2000×1227: sin scroll en ninguna pestaña.
