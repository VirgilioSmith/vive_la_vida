# Auditoría 05 · Simplificación integral (solo diagnóstico y propuestas)

Estado: **sin ninguna eliminación ejecutada**. Cada propuesta de la sección 3 requiere aprobación explícita.
Fecha de medición: 2026-11-19 · Commit base: `82980c0`+ · Método: análisis estático (AST/PostCSS), recorrido con Playwright (móvil 390×844, web 1440×900), pruebas existentes.

## 1. Métricas medidas (línea base)

| Métrica | Valor | Lectura |
|---|---|---|
| `src/app.js` | 21,965 líneas · 2.4 MB · un solo IIFE | Monolito por capas (174 módulos «V###» apilados) |
| `src/styles.css` | 55,198 líneas · 4.0 MB · 24,312 reglas · 81,313 declaraciones | Muy por encima de lo necesario |
| `!important` | 38,080 de 81,313 declaraciones (**46.8 %**) | Guerra de especificidad entre capas |
| Declaraciones duplicadas exactas (mismo selector+contexto+propiedad) | 373 | Eliminables sin cambio visual (verificable por píxel) |
| Variables CSS declaradas / sin uso | 843 / **199** | Candidatas a retirar |
| Funciones declaradas en JS | 1,210 · alcanzables 1,210 · muertas 0 | La limpieza anterior ya agotó lo muerto «por declaración» |
| Envoltorios de `render` | 8 (+3 de `v40Decorate`, 3 de `pages.cards`) | Cada render pasa por 8 capas |
| `MutationObserver` | 66 · `setTimeout` 60 · `requestAnimationFrame` 59 · listeners 545 | Riesgo de renderizados en cascada |
| Dependencias | `supabase.js` (220 KB), `reglas.js` (14 KB). Sin npm en runtime | Sanas |
| Score (iframe) | 9 archivos JS ≈ 177 KB + 27 KB CSS, cargados en el arranque para todos | Candidato a carga diferida |
| DOM inicial | ~1,800 nodos · heap ~10 MB | Correcto |
| Tiempo de render por página (ms, móvil/web) | Inicio 206/145 · **Movimientos 144/413** · Analítica 223/109 · Visión global 110/155 · resto 46–95 | Movimientos web (tabla) es el punto lento |

Limitaciones: tiempos medidos en entorno de pruebas sin red real ni dispositivo físico; el heap es el de Chromium headless.

## 2. Hallazgos por categoría

**Redundancia funcional y de información**
- Movimientos tiene dos vistas oficiales (tabla web y lista móvil). *Decisión del producto: se conservan (A).*
- Restos del flujo «conciliar/revisar» ya retirado de la interfaz: bandera `reviewed`, acción `toggleReview`, filtro `reviewFilter`, alertas «por conciliar», estilos `.v221-state`, `.tx-review`, `.v708-recon-*`, `.v708-apple-*`. Se mantiene solo para Suscripciones (decisión del usuario).
- Listas de widgets duplicadas en 5 sitios (`V105_WIDGETS`, `V318_GRAPH_META`, `V332_PERSONALIZATION_AREAS`, `V1123_ORDER`, `V752_PREMIUM_IDS`…) con ids que ya no existen (`budgetTrend`, `futureMap`).
- Tres sistemas de «tarjeta de resumen web»: `ff-*`, `v189-*`, `v1131-*`.
- Dos escalas tipográficas históricas (`v26/v203` frente a la nueva `--t-*`).

**Código/estilos obsoletos u opacos**
- 41 etiquetas `case` del despachador sin referencia aparente (muchas son claves de KPI y falsos positivos; requieren verificación individual).
- Reglas que el DOM actual ya no genera tras los rediseños (Suscripciones, Presupuesto, Categorías, Compromisos, Apple Pay).
- 8 banderas `settings.vNNN` de migraciones únicas ya cumplidas.

**Rendimiento**
- Movimientos web: 413 ms (tabla con filas de gran altura y 8 capas de render).
- Cada `render()` reconstruye la página completa; los `MutationObserver` reaplican decoraciones.
- CSS de 4 MB analizado en cada arranque.
- Score se carga aunque el usuario nunca lo abra.

**Experiencia**
- Web/móvil ya comparten escala tipográfica y selectores (hecho). Quedan diferencias: Resumen web (cuadrícula) vs Inicio móvil, y las pantallas de «hero» azul de Bancos/Cuentas/Tarjetas/Préstamos/Certificados con titular de 34 px que no existen en móvil.
- Varias vistas con texto explicativo largo que repite el título (p. ej. héroes de Egresos/Ingresos).

## 3. Propuestas numeradas por prioridad (ninguna ejecutada)

Cada ficha: qué existe → qué se propone → evidencia → sustituto → impacto web/móvil → beneficio → dependencias → riesgos → alternativa → recomendación. Clasificación A–E según el esquema solicitado.

### P1 · (E) Declaraciones CSS duplicadas exactas y variables sin uso
- **Existe:** 373 declaraciones repetidas (mismo selector, contexto y propiedad) y 199 variables sin lectura.
- **Propuesta:** eliminar la copia anterior de cada duplicado y las variables sin uso.
- **Evidencia:** análisis PostCSS reproducible (`docs/auditoria/css-muerto.js`).
- **Sustituye:** nada; se conserva la declaración ganadora.
- **Impacto:** ninguno visible (verificado por comparación de píxeles en las vistas principales, móvil/web, Claro/Black).
- **Beneficio:** −1–2 % de CSS; reduce confusión. Bajo.
- **Dependencias:** ninguna conocida; las variables se verifican también contra `app.js`.
- **Riesgo:** bajo; ya hubo una regresión (Préstamos) por limpieza de CSS, por eso exige verificación visual por pantalla y detalle.
- **Alternativa:** no hacerlo (beneficio pequeño).
- **Recomendación:** hacerlo **con** la prueba pixel a pixel ampliada a detalles (préstamo, tarjeta, cuenta, certificado).

### P2 · (C/D) Reducir `!important` (46.8 %) unificando en capas con `@layer`
- **Existe:** especificidad inflada mediante `html body #app#app …` y `!important`.
- **Propuesta:** migrar progresivamente a `@layer base, components, pages, overrides` y retirar `!important` por pantalla, empezando por las páginas nuevas (Suscripciones, Presupuesto, Categorías, Movimientos, Compromisos).
- **Beneficio:** mantenibilidad alta; menos bugs de «no aplica el estilo».
- **Riesgo:** medio-alto; cambia la cascada. Requiere hacerse pantalla por pantalla con comparación de píxeles.
- **Alternativa:** dejarlo y solo bloquear nuevos `!important`.
- **Recomendación:** iniciar por las 6 pantallas rediseñadas (no toca el resto).

### P3 · (D) Una sola fuente de verdad para la lista de widgets
- **Existe:** 5 listas con ids obsoletos.
- **Propuesta:** un único catálogo (`id, título, grupo, orden, visible por defecto, plataformas`) del que se derivan las demás; eliminar ids huérfanos.
- **Beneficio:** evita que reaparezcan widgets retirados; menos código.
- **Riesgo:** bajo-medio (preferencias guardadas por usuario: se migran, no se pierden).
- **Recomendación:** hacerlo.

### P4 · (D) Cadena de 8 envoltorios de `render` y 66 observers
- **Propuesta:** un único `render()` con hooks ordenados post-render; reemplazar observers por llamadas explícitas.
- **Beneficio:** mejor rendimiento percibido, depuración simple.
- **Riesgo:** **alto** (todo el comportamiento visual depende del orden actual).
- **Alternativa:** medir primero qué observers disparan trabajo real (instrumentación) y retirar solo los inertes.
- **Recomendación:** fase de medición (sin cambios) → luego decidir.

### P5 · (B) Movimientos web: 413 ms
- **Propuesta:** paginar/virtualizar las filas y diferir columnas de saldo; conserva la vista.
- **Beneficio:** −50 % en render de la página más pesada de web.
- **Riesgo:** bajo; **no se elimina nada**.
- **Recomendación:** hacerlo (reversible).

### P6 · (B) Cargar Score bajo demanda
- **Propuesta:** cargar los 9 scripts del Score solo al abrir la vista o al mostrar su tarjeta.
- **Beneficio:** −177 KB JS en el arranque; **no se elimina nada**.
- **Riesgo:** bajo.
- **Recomendación:** hacerlo (reversible).

### P7 · (E) Restos del flujo conciliar/revisar fuera de Suscripciones
- **Existe:** ver sección 2. Hoy `persist()` marca todo como revisado (salvo cobros recurrentes).
- **Propuesta:** retirar `reviewFilter`, la alerta «por conciliar», `toggleReview` fuera de Suscripciones y los estilos asociados.
- **Dependencias:** Suscripciones (se conserva), buscador global y KPIs que cuentan «por revisar».
- **Riesgo:** medio; hay que limpiar también datos de prueba.
- **Recomendación:** aprobar tras revisar la lista exacta de referencias.

### P8 · (C) Texto repetido en héroes de web
- **Propuesta:** reducir los héroes azules de Bancos/Cuentas/Tarjetas/Préstamos/Certificados, Egresos e Ingresos a título + cifra clave + acción, igual que móvil.
- **Beneficio:** menos desplazamiento y coherencia web/móvil.
- **Riesgo:** bajo (solo presentación); **sin eliminar funciones**.
- **Recomendación:** hacerlo por pantalla, con tu visto bueno visual.

### P9 · (E) Acciones del despachador sin referencia aparente (41 candidatas)
- **Propuesta:** verificar una por una (muchas son claves de KPI, falsos positivos) y eliminar las realmente inalcanzables.
- **Riesgo:** medio (referencias dinámicas).
- **Recomendación:** primero lista verificada para tu aprobación.

### P10 · (A) Conservar
Selectores universales, Registrar (hoja de 4 pestañas), asignación guiada de Presupuesto, Categorías con emoji, Suscripciones (incluida su revisión), vistas Movimientos web y móvil, Score móvil resumido, autenticación persistente, motor financiero y sincronización.

## 4. Puntuación de partida (estimada, no certificada)

Simplicidad 6 · Experiencia visual 8 · Web 7 · Móvil 8 · Rendimiento 6 · Eficiencia del código 5 · Estabilidad 8 · Seguridad 7 · Accesibilidad 7 · Mantenibilidad 4.
Son estimaciones respaldadas por las métricas de la sección 1; la certificación final con pruebas llegará al cerrar el ciclo. No se declara ningún 10/10.

## 5. Lo que necesito de ti
Aprobación, rechazo o ajuste por número de propuesta. Puedo empezar ya, sin eliminar nada, por **P5, P6 y P3 (parte de medición)**, que son reversibles.
