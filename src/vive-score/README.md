# VIVE SCORE CRÉDITO 5.0 · módulo experimental (solo escritorio)

Página nueva **«Score»** de la versión web de *vive el hoy*. Muestra un índice de crédito propio de 0 a 1 000 puntos, explicado factor por factor, calculado **solo con tarjetas de crédito y préstamos reales**.

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
| `score.js` | Motor y vistas del HTML de referencia (scorecard, evolución, patrones, observatorio, metodología, auditoría, sellos), adaptados a datos reales. |
| `state.js` | Estado, mensajería con el anfitrión y construcción de cada corte (datos reales + antecedentes declarados). |
| `questionnaire.js` | Cuestionario inteligente de calibración (solo mes y año). |
| `settings.js` | «Configuración y antecedentes»: procedencia de cada dato, edición con trazabilidad, borrado. |
| `transunion.js` | Pestaña «TransUnion (simulación)»: equivalencia orientativa en la escala pública 459–848, aporte por factor, 7 escenarios y comparación opcional con tu dato real. |
| `seed.js` | Antecedentes ya conocidos que se cargan automáticamente (aumentos de límite de Popular y Cibao). |
| `boot.js` | Arranque. |

Pruebas: `tests/vive-score.js` (`node tests/vive-score.js`).

## Páginas

Mi score · Evolución · Créditos y capacidad · TransUnion (simulación) · **Centro de control**.

El **Centro de control** es una sola página sin menú: cinco secciones plegables (*Observatorio*, *Historial y evidencias*, *Auditoría*, *Antecedentes*, *Configuración*) bajo una fila de indicadores. Los enlaces antiguos (`capacity`, `observatory`, `audit`…) siguen funcionando.

**Automatización:** las aperturas recientes (0–6 y 7–12 meses) se detectan solas por la fecha de apertura de cada producto; las preguntas manuales de «tarjetas nuevas» y «préstamos recientes» se omiten (solo aparecen si editas antecedentes). El fondo de la página Score es blanco puro (oscuro/negro puros en esos temas).

## Alimentación automática e independencia

**Leer → Analizar → Calcular → Mostrar.** El módulo nunca escribe en tarjetas, préstamos, movimientos, ingresos ni ningún otro dato de la app; solo guarda lo suyo (configuración, antecedentes, cortes y bitácora) en `localStorage['vive-score:v1']`.

- Se actualiza solo: mientras la página está abierta, el anfitrión lee en memoria los datos de la app (al volver a la pestaña, tras cada cambio visible y cada 5 s) y avisa al módulo **solo si algo cambió**. No hay consultas a Supabase ni procesos Realtime.
- Cada corte se calcula una sola vez (memoria de cálculo) para no repetir trabajo.

## De dónde salen los datos

El adaptador (`adapter.js`) solo **lee**, a través del puente `window.__viveScoreBridge` (también de solo lectura):

| Dato | Fuente |
|---|---|
| Tarjetas (una línea por moneda con límite o saldo; las que aún no tienen ni límite ni saldo también cuentan como apertura y antigüedad) | institución, producto, marca, moneda, límite, saldo, mínimo, saldo del estado, avances (últimos 90 días), apertura, tasa |
| Préstamos | institución, tipo, capital original, saldo, cuota, tasa, apertura, estado |
| Mora vigente | vencimientos sin pagar de tarjetas y préstamos (`upcoming()`) |
| Ingresos recurrentes | **solo para capacidad de endeudamiento**, siempre en base **mensual** y en RD$ (una nómina quincenal = 2 pagos al mes). Se lee el desglose bruto → AFP → SFS (ARS) → ISR → otros descuentos → neto |
| Ingresos laborales adicionales | bonos, comisiones, incentivos, horas extra, retroactivos y sueldo extraordinario registrados en vive el hoy; los reembolsos no cuentan. Se reconocen con el promedio de los últimos 6 meses si aparecen en ≥3 de ellos (proporcional si menos) |
| Destino del dinero | **solo para capacidad**: gastos registrados de los últimos 3 meses cerrados, separados en efectivo y transferencia/débito, y en esenciales y variables. Los esenciales (alimentación, vivienda, servicios, transporte, salud, educación, familia, seguros, impuestos) se descuentan del margen; los variables solo se muestran. Se dejan fuera para no contarlos dos veces: pagos de tarjeta y de préstamo, compras con tarjeta, transferencias entre cuentas propias, pagos recurrentes e intereses de deuda |
| Pagos recurrentes | **solo para capacidad**; los pagados con tarjeta se marcan para no duplicarlos |

**Entidades no financieras:** los productos de instituciones que no son financieras (telefonía, comercios, etc., según el tipo de institución de la app) **no puntúan**: sus adelantos y financiamientos no se reportan a los burós. **No entran para nada**: ni en el score, ni en la capacidad de endeudamiento, ni en listas, cuestionario o simulaciones (el adaptador ni siquiera los lee).

**No se leen** cuentas de ahorro, saldos bancarios, depósitos, patrimonio, inversiones ni transferencias. Una prueba lo comprueba (un depósito de RD$9 000 000 no mueve el score).

## Créditos recientes

Cada tarjeta y préstamo cuenta por su **mes y año de apertura** (el de «Editar» en vive el hoy; la fecha de la app manda sobre lo que se complete aquí). Se ve en *Mis créditos → Créditos recientes*: aperturas de **0–6 meses** y de **7–12 meses** (inclusivas, sin superponerse), también las de productos cerrados y las de tarjetas sin límite. Si falta la fecha, el producto dice «falta la fecha».

## Historial y fechas

- El historial **observado** empieza el **15 de noviembre de 2026**. Cada visita guarda (si cambió) el corte del mes; el último guardado de cada mes es su cierre.
- No se crean meses ni puntajes anteriores. Lo anterior son **antecedentes declarados** por ti, identificados como tales.
- Todas las preguntas históricas piden **solo mes y año**. Los vencimientos y pagos reales conservan su fecha exacta.
- Se distinguen: fecha de apertura bancaria, antigüedad declarada, antigüedad verificada (documento marcado como revisado), fecha de registro en la app, fecha de inicio de VIVE SCORE y fecha de los acontecimientos.

## Cuestionario

Siete pasos más resumen: atrasos, aumentos de límite, tarjetas nuevas, préstamos recientes, antigüedad, créditos cerrados y otros acontecimientos. Consulta primero los productos ya registrados para no repetir preguntas.

- Tu declaración inicial («nunca he tenido atrasos y estoy al día») aparece **precargada** y se guarda como *declaración personal*, no como evidencia bancaria.
- **No hay preguntas sobre consultas de buró** (TransUnion, Equifax u otros).
- **Antecedentes precargados** (`seed.js`): por indicación del titular, los aumentos automáticos de límite de **Popular (agosto de 2026: RD$200,000 y US$3,000 → RD$400,000 y US$6,000)** y de **Cibao (septiembre de 2026: RD$144,000 y US$2,000 → RD$400,000 y US$6,000)** se cargan solos, una vez, y ese paso del cuestionario se omite. Siguen siendo declaraciones personales, se pueden editar o quitar, y si se borran a propósito no se vuelven a cargar.
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

## Simulación TransUnion

Pestaña aparte, separada del score de VIVE. Solo TransUnion: **Equifax no publica parámetros, así que no se simula**.

- Equivalencia **orientativa y lineal**: `459 + VIVE ÷ 1 000 × (848 − 459)` (escala pública de TransUnion RD). Ya usamos los pesos públicos 35 / 30 / 15 / 10 / 10.
- TransUnion no publica su fórmula: **no es tu score real ni una predicción**. Sirve para comparar escenarios (pagar saldo, bajar el uso, límite automático o solicitado, tarjeta o préstamo nuevo, atraso).
- Si conoces tu score de TransUnion, puedes anotarlo (opcional, con mes y año): solo se compara; **no cambia** el VIVE SCORE.

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

**Borrar solo los datos de VIVE SCORE:** en la consola del navegador (la página ya no tiene botón de borrar) `localStorage.removeItem('vive-score:v1')`.

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

## Automatización y referencias (noviembre 2026)

- **Créditos recientes = solo 0–6 meses.** Cada apertura de tarjeta o préstamo en ese periodo resta 15 puntos en «Aperturas recientes» (base 60); los aumentos de límite *solicitados* en 0–6 meses restan 8 (base 40). Se detectan solos por la fecha de apertura de vive el hoy.
- **Historial de límites automático.** La app no guarda historial de límites; el módulo recuerda el último límite visto de cada tarjeta y moneda (`limitObs`). Si lo editas en vive el hoy, registra el cambio con fecha y hora exactas y lo cuenta desde ese mes y año. Un aumento se registra como *automático* (no resta); puedes marcarlo «Solicitado por mí» en Antecedentes. Una reducción se anota sin puntuar. La primera lectura es la línea base: no se inventa historia.
- **Reserva automática (solo capacidad, nunca el score).** «Dinero guardado» = lo más bajo que tuvo cada cuenta (y el efectivo) durante los últimos 30 días, convertido a pesos; lo que sacas o gastas deja de contar. La reserva de planificación (10 % del ingreso, mínimo RD$5,000) se reduce según la cobertura sobre 3 meses de compromisos. Ya no hay campos manuales de DTI ni reserva; el DTI objetivo (35 %) es una referencia fija.
- **Referencias consultadas.** Pesos FICO públicos: historial de pagos 35 %, montos adeudados 30 %, antigüedad 15 %, crédito nuevo 10 %, mezcla 10 % (los mismos de este modelo). VantageScore 4.0 (ficha oficial): historial 41 %, utilización 20 %, profundidad 20 %, crédito reciente 11 %, saldos 6 %, crédito disponible 2 %, con hasta 24 meses de datos de tendencia. No hay documentación pública verificable de la escala 459–848 de TransUnion RD ni de sus pesos, por lo que la simulación sigue marcada como orientativa.

## Guardado automático y Centro de control corto

- **Todo se guarda solo.** Respuestas, antecedentes, historial de límites, productos cancelados y observaciones mensuales se guardan al instante en el almacenamiento del navegador. Cada mes se genera solo un **corte** con huella SHA-256 que se actualiza mientras el mes siga abierto y queda fijo al cerrar. Ya no hay botones de exportar JSON/CSV, borrar, sellar ni «releer»; la lectura de vive el hoy es automática.
- **Centro de control:** fila de indicadores, tarjeta de estado (calibrado/incompleto + advertencias) y cuatro secciones plegables: *Antecedentes y procedencia*, *Productos y cancelados*, *Cortes guardados* y *Auditoría y pruebas*.
- **Productos cancelados:** los cerrados en vive el hoy se leen solos; los anteriores se agregan en *Productos y cancelados* (institución, tipo, mes/año de apertura y de cierre, estado final). Los cancelados en buen estado suman años a la antigüedad y a la edad promedio del historial; los castigados no suman. No restan puntos por sí mismos.

## Variables, Metodología y Patrones IA

- **Variables** y **Metodología** viven dentro del *Centro de control* como secciones plegables (cerradas por defecto). Antes eran pestañas.
- **Patrones IA** ya no tiene pestaña: el modelo no supervisado (k-medias sobre los cortes mensuales) no suma ni resta puntos; trabaja en segundo plano solo para marcar un corte atípico en Evolución y necesita al menos 4 cortes (el historial arranca el 15 de noviembre de 2026). Se explica en la sección *Metodología*.
- Enlaces antiguos: `matrix` → Variables; `method` y `patterns` → Metodología.

## Fondo transparente

El marco de VIVE SCORE es transparente y deja ver el fondo de las demás vistas de vive el hoy. La app declara `color-scheme: light dark`; si el marco no declara exactamente lo mismo (en el documento y en el elemento `iframe`), el navegador pinta un panel opaco cuando el sistema operativo está en modo oscuro. Por eso `frame.html` y `.vs-frame` usan `light dark`, y la prueba 28 lo comprueba con el sistema en modo claro y oscuro.

## Sin variables manuales

- **Todo lo actual es automático** desde vive el hoy: aperturas, cambios de límite, productos cancelados (el estado cerrado/saldado de la app), ingresos, compromisos, gasto esencial y reserva. No hay ningún dato personal (sexo, edad, estado civil, ocupación): no se pide ni se usa.
- **Lo único manual es el historial anterior a la app:** atrasos anteriores (una pregunta, solo mes y año) y productos cancelados antes de usar vive el hoy (Configuración → *Productos y cancelados*). El primer crédito solo se pregunta si la app no tiene fechas de apertura.
- Se retiraron las preguntas «tarjetas nuevas», «préstamos recientes», «aumentos de límite», «créditos cerrados» y «otros acontecimientos» del cuestionario (siguen disponibles al editar antecedentes solo para el límite y el primer crédito). La sección *Variables* del Centro de control lista únicamente las variables que el modelo realmente lee y su fuente.

## Productos cancelados cargados del reporte de crédito

Se cargan solos (una vez) los 9 productos cancelados del «Detalle de Cuentas Cerradas / Inactivas» del titular: 7 tarjetas (TC) y 2 préstamos (PR) de Banco Popular, Qik, Banco Santa Cruz, Asociación Cibao y Banco Lafise, con mes y año de apertura y de cierre y su límite. Altice se excluye (entidad no financiera). Suman antigüedad y edad promedio del historial; los abiertos en los últimos 6 meses (hoy, Banco Lafise 06/2026) cuentan como crédito reciente. Si coinciden con un producto que la app ya tiene (mismo tipo, mes de apertura e institución) no se cuentan dos veces. Puedes quitarlos en *Productos y cancelados*; si lo haces no se vuelven a cargar. La lista vive en `CANCELLED_SEED` de `seed.js`.
- **Estado final y atrasos de los cancelados.** Cada cancelado muestra «abierto mes año» y «cancelado/saldado mes año» (cierre = última transacción del reporte). Un préstamo que llegó a su fin queda **saldado** (completado) y una tarjeta **cancelada**. También guarda el vector de comportamiento de los últimos 12 meses del reporte (0 = al día … 7 = 181 días o más, `-` = sin historial) y su peor atraso; en los 9 cargados es «Sin atrasos». Si registras un cancelado con atraso, cuenta en el historial de pagos según su cierre.

## Metodología esquematizada y simulación TransUnion

- La sección *Metodología* del Centro de control se organiza por factor: **qué dice la fuente** (FICO, VantageScore 4.0, TransUnion RD) → **cómo lo aplica este modelo** → **fórmulas exactas**, que se leen del motor en vivo (nunca quedan desactualizadas). Incluye «Decisiones propias» (lo que ninguna fuente publica), las fuentes con enlace y las ecuaciones de capacidad vigentes.
- Las fuentes se abren en una pestaña nueva (el marco permite `allow-popups`).
- La pestaña *TransUnion (simulación)* sigue siendo una simulación: 459 + VIVE ÷ 1,000 × 389. Muestra en vivo las variables que la alimentan (atrasos, utilización, antigüedad, edad promedio, cancelados que suman, aperturas de 0–6 meses, límites, productos activos) y 9 escenarios, entre ellos cancelar la tarjeta de mayor límite y un atraso de 90 días. Al cargar cancelados o cambiar datos, todo se recalcula solo.
- La Ley 172-13 se reporta con 48 meses de vigencia de la información en los burós (una fuente menciona 5 años; verifica el texto oficial). El modelo mide la edad real del producto.

## Validación del motor

`node tests/vive-score-reglas.js` valida el motor y las pantallas de forma sistemática (12 comprobaciones): pesos 350/300/150/100/100 = 1000 y suma exacta de subreglas; anclas de las fórmulas publicadas; 600 perfiles aleatorios (score entero 0–1000 = suma de factores = suma de subreglas, sin NaN, monotonía en ambos sentidos y sin mutar los datos); condiciones (sin productos, todo cerrado, datos negativos, límite cero, USD, solo préstamo o solo tarjeta); calibrado; independencia de la capacidad; antigüedad con cancelados; conciliación entre cortes con 1 a 12 cortes; determinismo; coherencia de la Metodología y el README con el motor; y todas las pantallas en tres estados (normal, sin productos, datos inválidos). `node tests/vive-score.js` cubre la integración (39 comprobaciones).

Hallazgos corregidos con esta validación: la edad promedio exactamente 0 se reemplazaba por el 70 % de la antigüedad (hacía que «más antigüedad» pudiera bajar el score); los importes inválidos mostraban «NaN» (ahora «—»); y la Metodología no declaraba que cobranzas, castigos, incidencias judiciales, consultas a burós, reestructuraciones y refinanciamientos no tienen fuente de datos (hoy valen 0).
