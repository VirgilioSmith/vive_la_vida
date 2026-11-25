# Vive Glass Engine

Un solo material, seis niveles de profundidad, componentes universales.
Archivos: `src/glass-engine.css`, `src/glass-engine.js`, `glass-catalog.html`, `tests/glass-engine.js`.

## 1 · Auditoría previa (cifras reales del repositorio)

| Medida | Valor |
|---|---|
| Hojas CSS | 33 (≈ 4,5 MB) |
| Declaraciones `!important` | ≈ 41 000 |
| Usos de `backdrop-filter` | 342 |
| Colores `rgba(...)` dispersos | ≈ 3 760 |
| Sistema previo | `vx-tokens.css` / `vx-material.css` / `vx-components.css` (tokens `--vx-*`), `liquid-material.css`, `dynamic-appearance.css` (`--ui-glass-*`, `--lg-*`) |

Conclusiones: el material estaba repartido en ≥ 4 vocabularios de variables (`--vx-*`, `--ui-glass-*`, `--lg-*`, valores literales) y
muchos módulos fijaban fondos opacos (`#fff`, `#f8faff`) con `!important`, lo que impide ver el cristal. La lógica financiera no
participa en nada de esto y no se tocó.

## 2 · Arquitectura

`vx-tokens` (acento y texto) → **`glass-engine.css`** (variables `--vg-*`, niveles, componentes) → capa de migración (al final del mismo archivo).
El acento se lee de `--vx-accent` (que viene de Personalización); los colores financieros semánticos no dependen del acento.

### Niveles oficiales

| Nivel | Clase | Uso | Blur | Claro (alfa) | Black (alfa) |
|---|---|---|---|---|---|
| 00 | `.vg-l0` | superficie base | – | #FFFFFF | #000000 |
| 01 | `.vg-l1` | cristal ambiental (sin blur) | 0 | .34 | .035 |
| 02 | `.vg-l2` | cristal estructural: tarjetas, KPI | 14–16 | .54 | .06 |
| 03 | `.vg-l3` | cristal interactivo: botones, campos | 12 | .68 | .09 |
| 04 | `.vg-l4` | cristal flotante: navegación, hojas, popovers | 24–26 | .80 | .13 |
| 05 | `.vg-l5` | cristal prioritario: Centro estratégico | 28–30 | .86 | .17 |

### Variables universales

`--vg-k` (intensidad), `--vg-ak` (acento), `--vg-lk` (iluminación) · `--vg-a1…a5` (alfa) · `--vg-b1…b5` (blur) · `--vg-e1…e5` (borde óptico) ·
`--vg-sh1…sh5` (sombra) · `--vg-ink`, `--vg-ink-2`, `--vg-ink-3` (texto) · `--vg-base` · `--vg-accent`, `--vg-accent-strong`, `--vg-on-accent` · `--vg-focus`.

### Componentes

`vg-surface`, `vg-card`, `vg-button` (+`is-primary`, `is-loading`), `vg-icon-button`, `vg-input`, `vg-select`, `vg-nav`, `vg-modal`, `vg-sheet`,
`vg-tooltip`, `vg-popover`, `vg-segmented`, `vg-notification`, `vg-kpi`, `vg-table`, `vg-chart`, `vg-strategic`.
Estados: hover (luz bajo el cursor solo en escritorio), press (`scale(.97)`), focus-visible (anillo de acento), selected (`aria-pressed`), disabled, loading (`aria-busy`).

### Reglas de rendimiento

* Blur solo en niveles 02–05; `.vg-flat` evita blur anidado; en táctil el blur baja a 20–22 px.
* Solo se anima `transform` y `opacity`. Nunca se anima el blur.
* La luz del cursor escribe dos variables CSS en el elemento bajo el puntero, con `requestAnimationFrame`; no toca el DOM.
* Los reflejos son capas de `background` (no capturan eventos).
* Accesibilidad: `prefers-reduced-transparency`, `prefers-reduced-motion`, `forced-colors`, y degradación si el navegador no soporta `backdrop-filter`.

### Preferencias

Ajustes › Apariencia › *Liquid Glass universal*: intensidad del cristal, del acento, de la iluminación (0–160 %), reducir transparencia,
reducir movimiento y *Restaurar valores esenciales*. El cambio se aplica al instante (variables CSS en `<html>`). Se guarda **una sola vez al soltar**
el control, reutilizando `db.settings` + `persist()` (claves planas `glassIntensity`, `glassAccent`, `glassLight`, `glassReduceTransparency`, `glassReduceMotion`).
Arrastrar un control no genera peticiones a Supabase (lo verifica la prueba). Copia local en `localStorage` para evitar parpadeo al arrancar.

## 3 · Migrado al motor

* **Controles segmentados** (Gasto/Ingreso/Transferencia y equivalentes en formularios): contenedor sin fondo, píldoras independientes.
* **Hojas de detalle** «Presión financiera» y «Huella de gastos» (nivel 04), hoja «Registrar abono / Perdonar deuda» y «Conciliar un saldo».
* **Formularios**: flecha atrás universal, sin «×» ni banners de identidad repetidos.
* **Preferencias** de Apariencia (usa los componentes del motor).

### Óptica v2 (R6–R7)

Las filas y tarjetas heredadas migradas (Inicio, Movimientos, Ajustes, Ingresos, Cuentas, Préstamos, Explorar, Egresos, Buscar, Certificados, Beneficios, Personalizar)
reciben cinco capas: franja especular diagonal, reflejo superior, luz de esquina con pigmento de acento, pigmento ambiental inferior y borde claro con arista
superior brillante, más sombra de contacto con calor de acento. Tarjetas principales con desenfoque (nivel 02); filas sin desenfoque (relleno firme).
En Black el relleno denso baja a +.015 (`--vg-dense-add`) para no convertirlo en gris.

## 4 · Pendiente (no se declara terminado)

La app tiene 33 hojas CSS y ≈ 41 000 `!important`; migrar todos los módulos de una sola vez no es verificable ni seguro.
Sin migrar todavía: Inicio, Explorar, Bienestar, Vive Consciente, Vive Score, Bancos, Tarjetas, Préstamos, Suscripciones, Gratitud patrimonial,
Mi garaje, Metas, Centro estratégico (la hoja Momentos mantiene su propio fondo inmersivo), tablas y gráficas internas, y el resto de ventanas emergentes.
Plan: migrar por módulo sustituyendo sus fondos/bordes/sombras literales por `vg-*` (la capa de migración al final de `glass-engine.css`),
con prueba visual antes/después por módulo.

## 5 · Excepciones justificadas

* **Momentos** (reproductor inmersivo): fondo propio a pantalla completa; solo consume `color-scheme` oscuro.
* **Colores financieros** (ingreso/egreso/riesgo) e **identidad bancaria** (logos, Visa/Mastercard): no son acento ni material.
* **Hojas de selección** heredadas con `!important` extremo se migran módulo a módulo para no romper especificidad.

## 6 · Pruebas

`node tests/glass-engine.js` (44 verificaciones): fondo base puro (#FFF / #000), alfa creciente por nivel, blur solo 02–05, contraste de texto ≥ 7 por nivel,
6 acentos × 2 temas (primario y segmentado), intensidades 0/100/160 %, reducir transparencia/movimiento, foco, deshabilitado, sin desbordes en 1280 y 390,
integración en la app (segmentado sin fondo, preferencias al instante sin red) y sin errores de JavaScript.
Catálogo visual: abrir `glass-catalog.html` (Claro/Black, 6 acentos, sliders de intensidad).
