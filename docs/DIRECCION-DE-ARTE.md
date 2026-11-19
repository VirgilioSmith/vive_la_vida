# Dirección de arte · vive el hoy · Finanzas 360

Guía viva. Describe lo que **ya existe y está aprobado** en la implementación actual, más las reglas que se aplican a todo cambio futuro. No sustituye las instrucciones específicas de cada tarea. Las medidas de este documento se tomaron en el navegador (1440×900 y 390×844) con Playwright sobre datos de demostración.

## 1. Idea central
*Comprender el presente financiero para tomar mejores decisiones.* La jerarquía visual responde a cinco preguntas: ¿dónde estoy?, ¿qué ocurre?, ¿cómo evoluciono?, ¿qué necesita atención?, ¿qué decisión puedo tomar? Un KPI protagonista por vista; el resto es contexto o acción secundaria.

## 2. Narrativa por vista (no autoriza a cambiar funciones)
| Vista | Pregunta que responde |
|---|---|
| Resumen | posición financiera actual |
| Analítica avanzada | patrones, comportamientos, oportunidades |
| Patrimonio | evolución y composición de la riqueza |
| Suscripciones | compromisos recurrentes |
| Entre personas | relaciones financieras |
| Instituciones / Cuentas / Tarjetas / Préstamos / Certificados | productos, liquidez, crédito, deuda, inversión |
| Movimientos / Ingresos / Egresos / Presupuestos / Categorías | historia, entradas, salidas, límites, clasificación |
| Visión Global, Calendario y presión | relaciones y anticipación de liquidez |
| Score | indicadores que afectan el perfil crediticio |

## 3. Sistema visual vigente
**Tipografía.** Una sola familia (`--v397-font`: SF Pro / Inter / Segoe UI). Título de página: web 30,24 px (Resumen 33 px, aprobado), móvil 24 px (Resumen/Analítica 29 px). Pesos 680–850 en títulos y cifras; etiquetas secundarias nunca por debajo de **10,5 px**. Las cifras financieras usan cifras tabulares y peso alto.

**Color.** Un único acento dinámico: `--v424-accent-strong` (derivado de `--v953-accent`). Claro = superficies blancas, bordes finos, sombras discretas; Black = negro auténtico (`rgb(0,0,0)`), jerarquía por contraste y profundidad, sin bordes ni fondos claros. Los colores semánticos (riesgo, cumplimiento, vencido) no cambian con el acento.

**Geometría.**
- Contenido web: borde izquierdo 119 px, ancho 1273 px (Resumen: 110 px / 1290 px, aprobado).
- Banners principales (web): radio **28 px** para todos (`.bank-hero`, `.v1170-hero`, `.v58-exec`, `.v134-hero`).
- Selector de mes compacto (referencia: Resumen): 150×33 px, texto 10 px, alineado a la derecha bajo la barra de pestañas (top 112 px); el contenido empieza ~8 px debajo.
- Control segmentado sobre banner: vidrio (`rgba(255,255,255,.14)`, borde `rgba(255,255,255,.22)`, radio 14 px, opción activa blanca con texto de acento, botones 30 px de alto, 10 px / 780).
- Filtro de instituciones: cristal traslúcido, botones de 46 px, activa con degradado de acento.
- Hojas modales móviles: botón principal a todo el ancho, una sola línea, centrado.

**Iconografía.** Trazo lineal uniforme (`icon()` del propio sistema). Sin emojis ni símbolos decorativos.

**Gráficos.** Escalas legibles, líneas que pasan por sus puntos (interpolación monótona, sin sobreimpulsos), sin simulaciones de valores futuros. La exactitud manda sobre la estética.

**Movimiento.** Transiciones cortas y con propósito; hay 150 bloques `@media (prefers-reduced-motion)` en `styles.css`. Sin rebotes, destellos ni cambios bruscos de tamaño.

## 4. Web frente a móvil
Misma identidad, distinta composición. Web: lectura horizontal, KPIs y tablas amplias. Móvil: encabezados compactos, una columna, controles táctiles, hojas inferiores. No se copia la composición web en una columna.

## 5. Decisiones que deben permanecer
- Resumen, Analítica y Patrimonio están aprobados; no rediseñar sin petición.
- Vistas protegidas: Movimientos, Ingresos, Egresos, Suscripciones, Presupuestos, Categorías, Visión Global, Presión financiera/Calendario.
- No ocultar información para simular una pantalla sin scroll. Eliminar solo lo que el titular pida expresamente.
- Los cobros recurrentes y las cuotas automáticas se confirman solos; no hay pantalla de «revisar cobros».

## 6. Auditoría artística (última pasada)
Medido en 18 vistas × (web, móvil) × (Claro, Black):
- Sin desbordes horizontales del documento ni errores de página.
- Fondo Black = negro puro en todas las vistas.
- **Corregido:** Analítica avanzada (web, Black) mostraba bordes/fondos claros en las tablas de categorías.
- **Corregido:** radios de banner entre 26 y 30 px → 28 px.
- **Corregido:** etiquetas de 9–9,8 px («8 compromisos registrados», «Conciliado») → mínimo 10,5 px.
- **Revisado y conservado por ser intencional:** Resumen con ancho/título propios; carruseles de días (Suscripciones), gráficos con scroll lateral y tablas con scroll en móvil.
- **Pendiente (impacto bajo):** porcentajes de 9,5 px en las barras mensuales de Presupuestos (requiere rediseñar la rejilla); capas de reglas `!important` heredadas (ver `docs/auditoria/AUDITORIA-05-SIMPLIFICACION.md`, P2).

## 7. Control de calidad para cambios futuros
Cada componente nuevo o modificado se evalúa en: identidad, narrativa, coherencia cromática, legibilidad, jerarquía, composición, dimensionamiento, responsive, accesibilidad e integración. Antes de dar por cerrado un cambio:
1. Revisar en 1440×900 y 390×844, Claro y Black, y al menos dos acentos.
2. Comprobar estados vacío, con datos abundantes y de error.
3. Ejecutar `tests/ejecutar-todo.sh` (o al menos `smoke`, `csp`, `detalles` y la prueba de la vista tocada).
4. No declarar certificación completa sin evidencia: indicar qué se midió y qué no.
