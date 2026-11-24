# VIVE · FASE 04/10 — Coherencia tipográfica y legibilidad
(El «Protocolo Maestro de Corrección Acumulativa» no fue entregado en la conversación; se aplicó como: corregir primero lo heredado de las fases 01–03.)

## Método: corrección en origen, sin añadir otra capa
Se normalizaron los CSS existentes con una herramienta basada en postcss (no se añadió una hoja de parches):
- `font-weight` → escala de 4 pesos (400/500/600/700) en **1.908 declaraciones**; `font:` abreviado y atributos SVG/inline de `app.js` incluidos; `<b>/<strong>` fijados a 700 (el `bolder` del navegador producía 900).
- Tamaño mínimo 12 px en ≈2.400 declaraciones (también dentro de `clamp()/min()/max()` y `rem`). Excepciones deliberadas: insignias (`vive-score-badge`, contador de notificaciones, iniciales de logos).
- Acento como texto: 211 usos de `color:var(--v424-accent-strong)` pasan a `--vx-accent-ink` (Claro = acento fuerte oscuro; Black = acento legible claro). El relleno sigue usando el acento fuerte.
- Cifras tabulares globales (`body{font-variant-numeric:tabular-nums}`); importes (`RD$`/`US$`) marcados `.vx-money` por una pasada en cada render (sin observadores): nunca se encogen ni se cortan.

## Medición (`tests/tipografia.js`, 20 rutas × PC/móvil/tableta × Claro/Black)
| | Antes | Después |
|---|---|---|
| Pesos tipográficos distintos | 30–34 | **4** |
| Textos ≥ 800 | 430–500 | **0** |
| Textos < 12 px | 682 PC · 1.156 móvil · 774 tableta | **26 · 1 · 27** (insignias/marcas) |
| Importes recortados | 0 PC · 2 móvil · 13 tableta | **0 en todos** |
| Importes sin cifras tabulares | 56–71 | **0** |

## Estrés (`tests/tipografia-estres.js`)
Zoom 200 % (720×450 y 320×568), importes de 98.765.432.109,87 y nombres de 80 caracteres, estados vacíos, y detalle de Trabajo formal/Joseo: sin desborde, sin importes recortados, sin NaN, solo pesos 400–700, sin texto < 12 px, flecha «Volver a Ingresos» presente.

## Contraste WCAG 2.2 AA (medido sobre píxeles reales)
| Contexto | Fase 02 inicio | Fase 03 | Ahora |
|---|---|---|---|
| PC Claro | 25,6 % | 12,9 % | **7,7 %** (96/1.254) |
| PC Black | 14,1 % | 11,6 % | **6,7 %** (83/1.237) |
| Móvil Claro | 25,8 % | 12,1 % | **9,9 %** (56/564) |
| Móvil Black | 9,5 % | 9,0 % | **6,6 %** (35/534) |
| PC Claro, acento rojo | — | 14,9 % | 9,6 % |
| Móvil Claro, acento verde | — | 14,4 % | 13,1 % |
Se corrigieron en origen: pestañas de módulo (JS pintaba `#607a9d` inline), insignia de notificaciones, variaciones ±, mosaicos de KPI en héroes, pesos/colores heredados. **Sigue sin cumplirse AA al 100 %**: restan textos blancos de 17 px sobre degradados de héroe, etiquetas sobre acento en Black y el acento verde sobre vidrio claro. Detalle por selector en `docs/auditoria/fase02/contraste-app.json`.

## Otros arreglos
Lupa del buscador de Wallet PC (10×20 px por padding en un botón de 42 px) → 20×20; iconos en botones no se comprimen.

## Pendiente / no verificado
Tamaños < 12 px restantes (insignias), 750/900 residuales en SVG de gráficos, contraste AA completo, iPhone/iPad físico y PWA instalada. `tests/prestamos.js` P3-390 falla igual sin estos cambios.
