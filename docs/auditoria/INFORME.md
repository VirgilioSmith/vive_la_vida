# Auditoría integral — informe parcial

Alcance ejecutado: recorrido E2E de 27 pantallas × móvil/escritorio × Claro/Black, accesibilidad con axe (WCAG 2.2 AA), medición de Core Web Vitals y revisión del flujo de ingresos. **No se auditó** RLS/Supabase en vivo, memory leaks, listeners duplicados ni el inventario completo de modales (ver «Pendiente»).

## Hallazgos corregidos
| Prio | Hallazgo | Causa raíz | Corrección | Evidencia |
|---|---|---|---|---|
| P2 | Enter en Ingreso recurrente guardaba la fuente saltando pasos; Enter en Registrar cobro registraba sin confirmar; triple toque saltaba pasos | Envío implícito del formulario | Guardas de `submit` y antirrebote | `tests/adversarial.js` G1–G4 |
| P3 | Modo Black: matriz anual y lectura del patrimonio con fondo claro y texto claro (ilegibles) | Reglas de tema sin cubrir esas tablas | Overrides en `styles.css` | captura antes/después; `light.js` sin superficies claras |
| P3 | Cifra «RD$2,000,053» partida en dos líneas en la matriz anual (móvil) | Sin `nowrap` | `white-space:nowrap` + tamaño fluido | captura |
| P3 | Contraste < 4.5:1 en textos secundarios y acentos | Colores fijos por capa | Colores con contraste AA y acento mezclado con blanco en Black | axe: nodos con fallo de contraste Claro 122→11, Black 200→71 |
| P3 | `id="monthFilter"` duplicado (inicio y avanzado) | Dos controles con el mismo id | `monthFilterDash` + manejador | axe/recorrido: 0 ids duplicados |
| P3 | `role=img` con hijos interactivos; `<i>` con `aria-label` sin rol; puntos del wallet de 7 px | ARIA incorrecto / área táctil | `role="group"`, `role="img"`, área de 24 px | axe: `nested-interactive`, `aria-prohibited-attr`, `target-size` = 0 |
| P3 | Superficies de los flujos no seguían Claro #FFFFFF / Black #000000 | Grises fijos | Tokens únicos + brillo de acento | comprobación 21 de `tests/flujos-ingresos.js` |

## Métricas (arnés Playwright, datos de demostración, mediana de 3)
| Vista | LCP antes → ahora | CLS | INP | TBT antes → ahora |
|---|---|---|---|---|
| Móvil | 5688 → 5592 ms | 0 | 80 ms | 565 → 411 ms |
| Escritorio | 6284 → 6256 ms | 0 | 272 → 240 ms | 1195 → 1279 ms |

CLS e INP (móvil) cumplen. **LCP no cumple el objetivo de 2,5 s** (≈6 s): se debe sobre todo al peso de `app.js` + `styles.css` sin minificar ni comprimir (~6,3 MB, ya en `docs/12-deuda-tecnica.md`); en el arnés además no hay compresión de red. INP de escritorio (240 ms) supera 200 ms. La diferencia antes/ahora está dentro del ruido; no se optimizó el rendimiento.

## Pendiente (no hecho)
- P0/P1: revisión de RLS y privilegios de `anon` con los avisos de Supabase; idempotencia en el servidor.
- P2: minificación y compresión de recursos, partición de `app.js`; INP de escritorio.
- P2: memory leaks y listeners duplicados (no medidos); `aria-hidden-focus` en un SVG de Inicio (1 caso, sin localizar).
- Contraste: ~11 (Claro) y ~71 (Black) nodos restantes, parte falsos positivos de axe con `color-mix`.
- Inventario completo de modales y submódulos; pruebas visuales por comparación de imágenes.

## Cómo reproducir
```
AXE=/ruta/axe.min.js node tests/auditoria-recorrido.js salida.json   # THEME=black para Black
node tests/rendimiento-web-vitals.js                                  # ROOT=/copia para comparar
node tests/adversarial.js && node tests/flujos-ingresos.js
```
