# VIVE SCORE CRÉDITO 5.0 · módulo experimental (solo escritorio)

Página nueva **«Score»** de la versión web de *vive el hoy · Finanzas 360*. Muestra un índice de crédito propio de 0 a 1 000 puntos, explicado factor por factor, calculado **solo con tarjetas de crédito y préstamos reales**.

- Es un **modelo educativo propio**. No es un score oficial ni una probabilidad de impago, y no está calibrado contra TransUnion, Equifax ni FICO.
- Es **experimental, aislado y reversible**: vive en esta carpeta, detrás del interruptor `VIVE_SCORE_EXPERIMENTAL`, con su propio estado y almacenamiento.
- **No existe en móvil**: ni el ítem de menú ni la página.

---

## Qué hay aquí

| Archivo | Función |
|---|---|
| `flag.js` | Interruptor `window.VIVE_SCORE_EXPERIMENTAL`. En `false` el módulo queda inerte. |
| `adapter.js` | **Adaptador de solo lectura.** Convierte los datos existentes en una «carga» para el motor. |
| `host.js` · `host.css` | Anfitrión: número del ítem lateral, montaje de la página en un `iframe` aislado, persistencia experimental. |
| `frame.html` · `frame.css` | Página (documento aislado con su propia CSP). Estilos del HTML de referencia + acento dinámico + modos Claro/Oscuro/Black. |
| `score.js` | Motor y vistas del HTML de referencia (scorecard, evolución, simulador, patrones, observatorio, metodología, auditoría, sellos, resguardo), adaptados a datos reales. |
| `state.js` | Estado, mensajería con el anfitrión y construcción de cada corte (datos reales + antecedentes declarados). |
| `questionnaire.js` | Cuestionario inteligente de calibración (solo mes y año). |
| `settings.js` | «Configuración y antecedentes»: procedencia de cada dato, edición con trazabilidad, borrado. |
| `boot.js` | Arranque. |

Pruebas: `tests/vive-score.js` (`node tests/vive-score.js`).

## De dónde salen los datos

El adaptador (`adapter.js`) solo **lee**, a través del puente `window.__viveScoreBridge` (también de solo lectura):

| Dato | Fuente |
|---|---|
| Tarjetas (una línea por moneda con límite o saldo) | institución, producto, marca, moneda, límite, saldo, mínimo, saldo del estado, avances (últimos 90 días), apertura, tasa |
| Préstamos | institución, tipo, capital original, saldo, cuota, tasa, apertura, estado |
| Mora vigente | vencimientos sin pagar de tarjetas y préstamos (`upcoming()`) |
| Ingresos recurrentes | **solo para capacidad de endeudamiento** |
| Pagos recurrentes | **solo para capacidad**; los pagados con tarjeta se marcan para no duplicarlos |

**No se leen** cuentas de ahorro, saldos bancarios, depósitos, patrimonio, inversiones ni transferencias. Una prueba lo comprueba (un depósito de RD$9 000 000 no mueve el score).

## Historial y fechas

- El historial **observado** empieza el **15 de noviembre de 2026**. Cada visita guarda (si cambió) el corte del mes; el último guardado de cada mes es su cierre.
- No se crean meses ni puntajes anteriores. Lo anterior son **antecedentes declarados** por ti, identificados como tales.
- Todas las preguntas históricas piden **solo mes y año**. Los vencimientos y pagos reales conservan su fecha exacta.
- Se distinguen: fecha de apertura bancaria, antigüedad declarada, antigüedad verificada (documento marcado como revisado), fecha de registro en la app, fecha de inicio de VIVE SCORE y fecha de los acontecimientos.

## Cuestionario

Siete pasos más resumen: atrasos, aumentos de límite, tarjetas nuevas, préstamos recientes, antigüedad, créditos cerrados y otros acontecimientos. Consulta primero los productos ya registrados para no repetir preguntas.

- Tu declaración inicial («nunca he tenido atrasos y estoy al día») aparece **precargada** y se guarda como *declaración personal*, no como evidencia bancaria.
- **No hay preguntas sobre consultas de buró** (TransUnion, Equifax u otros).
- Se puede editar luego; cada versión queda registrada y los cortes se recalculan como *corrección de información*.
- Sin respuesta a atrasos (o «No estoy seguro») o sin antigüedad conocida, **el score no se calcula** y se muestra qué falta.

## Modelo matemático (versión 5.0.0)

Suma de cinco factores = **1 000 puntos** (pesos 35 / 30 / 15 / 10 / 10). Es determinista y reproducible; cada subregla se muestra en la pestaña *Metodología*.

| Factor | Máx. | Subreglas |
|---|---:|---|
| Historial de pagos | 350 | Puntualidad reciente 235 (−18 por mora 1–29 d, −75 por 30–59, −100 por 60–89, −135 por 90–119, −165 por 120+) · Antecedentes 80 (−8 mora antigua, −12 reestructuración y −6 refinanciamiento en 24 m, cobranzas, castigos) · Atraso vigente 35 |
| Deuda y utilización | 300 | Uso agregado de tarjetas 180 (interpolación 1 % → 180 … 100 % → 12) · Tarjeta más usada 45 · Tarjetas tensionadas/sobrelímite 25 · Amortización de préstamos 35 · Avances de efectivo 15 |
| Antigüedad | 150 | Cuenta más antigua 75 (120 m) · Antigüedad media 45 (84 m) · Profundidad de evidencia 30 (24 m) |
| Crédito reciente | 100 | Aperturas 0–6 m / 7–12 m 60 (−15 / −6 cada una) · Aumentos de límite **solicitados** 40 (−8 / −3; los automáticos no restan) |
| Composición | 100 | Gestión de productos existentes 65 · Combinación revolvente + cuotas 35 |

Decisiones y límites:
- Sin información no se inventan puntos por ella. Valores neutros de la referencia: sin tarjetas el uso agregado vale 135/180; sin préstamos la amortización vale 26/35.
- Los ingresos y gastos **nunca** suman puntos.
- Aprendizaje no supervisado (k‑medias determinista, normalización robusta por mediana e IQR, detección de atipicidad, deriva): **separado** del score. Con menos de 4 cortes no se forman grupos. Los grupos no son probabilidades de impago.
- Capacidad de endeudamiento: motor independiente (DTI contractual, margen, cuota nueva orientativa, estrés), con ingresos ponderados por evidencia y recurrencia.

## Persistencia y seguridad

- Almacenamiento experimental aparte: `localStorage['vive-score:v1']` del navegador. No toca tablas, tarjetas, préstamos, movimientos ni ingresos.
- El documento aislado tiene CSP propia (`connect-src 'none'`): **no hace ninguna llamada de red**, no usa Realtime y no consulta Supabase. Sin credenciales en el cliente.
- Entradas validadas (mes/año con formato `AAAA-MM`, números no negativos), identificadores únicos, registro de modificaciones (`audit`) y sellos con huella SHA‑256.
- No hay sincronización con Supabase en esta versión (ver «Limitaciones»).

## Puntos de integración con la app original

Todos están marcados con `VIVE_SCORE` (excepto los de datos de menú) y son mínimos:

**`index.html`**
1. `<link … vive-score/host.css>`
2. `<script … vive-score/flag.js>` (antes de `app.js`)
3. `<script … vive-score/adapter.js>` y `<script … vive-score/host.js>` (después de `app.js`)

**`src/app.js`**
4. `RAIL_DESTINATIONS`: ítem `['score','Score','score',…]` (condicionado al interruptor), debajo de «Presión financiera».
5. `V153_RAIL_ICONS.score`: icono propio.
6. `nav()`: número del puntaje en el ítem y exclusión del ítem en móvil.
7. `pages.score`, `heads.score`, `V394_TITLES.score`: la página, su título y subtítulo.
8. `window.__viveScoreBridge`: puente de solo lectura (junto a `__viveCore`).

## Desactivar o retirar el experimento

**Apagar (reversible, sin tocar código de la app):** en `src/vive-score/flag.js` pon `window.VIVE_SCORE_EXPERIMENTAL=false;`. Desaparecen el ítem, la página y el puente.

**Borrar solo los datos de VIVE SCORE:** *Configuración y antecedentes → Borrar los datos de VIVE SCORE*, o en la consola del navegador `localStorage.removeItem('vive-score:v1')`.

**Retirar el módulo por completo:**
1. `git revert <commit de implementación>` (o restaurar los archivos desde la rama `backup/pre-vive-score` (commit `55f3441`, anterior a la implementación)), o a mano:
2. Borrar la carpeta `src/vive-score/` y `tests/vive-score.js`.
3. Quitar de `index.html` las 4 líneas de `vive-score`.
4. Quitar de `src/app.js` los 8 puntos anteriores (buscar `VIVE_SCORE`, `score:` en `V153_RAIL_ICONS`, `heads`, `V394_TITLES` y `pages`, y el filtro/insignia en `nav()`).
5. Borrar `localStorage['vive-score:v1']`.

El resto de la aplicación no depende de nada de esta carpeta.

## Limitaciones conocidas

- La persistencia es **local al navegador**: no se sincroniza entre dispositivos. Una futura tabla con RLS (`user_id = auth.uid()`) quedaría fuera de las tablas existentes; no se creó porque no es necesaria para el experimento.
- Los avances de efectivo se estiman con los de los últimos 90 días (la app no registra qué parte del avance ya se pagó).
- Las tarjetas con límite en pesos y en dólares se evalúan como dos líneas.
- La mora vigente sale de los vencimientos de la app; si hay pagos sin conciliar, aparece como mora y el módulo lo avisa.
- Solo hay un corte hasta que pase el primer cierre mensual; evolución, patrones y anomalías necesitan más meses.
- El indicador del ítem lateral muestra el último puntaje calculado al abrir la página, no se recalcula en segundo plano.
