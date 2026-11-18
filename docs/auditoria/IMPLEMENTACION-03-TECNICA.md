# IMPLEMENTACION-03-TECNICA · remediación controlada

Fuentes de verdad: [AUDITORIA-01-TECNICA](AUDITORIA-01-TECNICA.md) y [AUDITORIA-02-EXPERIENCIA](AUDITORIA-02-EXPERIENCIA.md). Respaldo previo: rama `respaldo-antes-de-remediacion` (el servidor rechaza subir etiquetas). Método por hallazgo: reproducir → causa raíz → prueba de regresión que **falla antes** → corrección mínima → ejecución de pruebas → dependencias → evidencia. Todo cambio es un commit pequeño y reversible (`git revert <commit>`).
Regla inicial: no tocar producción sin autorización. **Autorización recibida después ("para todo en adelante")**; las acciones en producción se registran en la sección 7.

## 1. Resumen
| Resultado | Hallazgos |
|---|---|
| Corregido en el cliente y verificado | H-09, H-15, UX-01, UX-02, UX-03 |
| Aplicado en producción tras pruebas locales | H-01 (migración), H-04 (receptor y adaptador de Apple Pay) |
| Reclasificado: no es defecto | H-07 (regla de redondeo documentada) |
| Verificado como correcto (antes «no verificado») | prueba SQL de vigencias (H-20 parcial) |
| Pendiente (requiere decisión o acceso) | H-02, H-03, H-04, H-08, H-10, H-11, H-12 (parte cliente), H-14, H-16, H-17, H-18 |

## 2. Comparativo antes y después
| Hallazgo | Medida | Antes | Después | Prueba |
|---|---|---|---|---|
| H-09 fechas por zona | Con el dispositivo en Auckland a las 20:00 UTC del 31-dic: «hoy» / mes / año iniciales | 2026-12-31 / 2026-12 / **2027** (inconsistente) | 2026-12-31 / 2026-12 / **2026** | `remediacion-03.js` H-09 |
| H-15 fuga de listeners | Listeners globales tras abrir y cerrar 10 veces el asistente | **+10** | **+1** (el último abierto) | `remediacion-03.js` H-15 |
| UX-01 foco en modales | Tab fuera del modal (40 pulsaciones) / primer Tab dentro | **13** fuera / no | **0** fuera / sí | `remediacion-03.js` UX-01, UX-01b |
| UX-02 indicador de foco | Paradas de teclado sin indicador (26 pantallas × 2 anchos, 2 255 paradas) | **100** (4,4 %) | **2** (0,09 %) | `kb.js` (ver evidencias) + `remediacion-03.js` UX-02 |
| UX-03 nombre accesible | Paradas sin nombre | **51** | **0** | `remediacion-03.js` UX-03 |
| H-01 validación en servidor | Saldo de 1e15 en `finance_apply_changes` | **aceptado** (revisión 1) | **rechazado** (22003), sin escribir ni cambiar la revisión | `supabase/tests/finance_apply_changes.sql` |

## 3. Detalle por hallazgo (trazabilidad)
### H-09 · Año y mes actuales según la zona del dispositivo
* **Reproducción**: contexto Playwright con `timezoneId=Pacific/Auckland` y fecha fija 2026-12-31T20:00Z → `ui.year=2027` mientras `ui.month=2026-12`.
* **Causa raíz**: `today()` usa `America/Santo_Domingo`, pero 33 usos de `new Date().getFullYear()/getMonth()` usan la zona local.
* **Corrección** (`src/app.js`): helpers `nowYear()`/`nowMonth()` derivados de `today()` y sustitución de los 33 usos; la variable local de `glassTrend` se renombró a `curYear` para evitar colisión.
* **Dependencias**: filtros de año/mes, historial de tarjetas, beneficios, presupuestos y analítica (lectura de `ui.year`, `ui.cardHistoryYear`). Sin cambio para usuarios en Santo Domingo.
* **Pruebas**: `remediacion-03.js` H-09 (falla antes, pasa después); `logica/run.js` (256 paridades, 65 correctas, 0 errores).

### H-15 · Fuga de listeners en el selector de instituciones
* **Causa raíz**: `v1110BankPicker` añade un `keydown` a `document` por instancia y nunca lo retira.
* **Corrección** (`src/app.js`): registro de manejadores; el manejador se retira solo si su selector ya no está en el documento, y cada instancia nueva purga los obsoletos. Equivale a +1 en lugar de +N.
* **Prueba**: `remediacion-03.js` H-15 mide con CDP (`DOMDebugger.getEventListeners`): +10 → +1.

### UX-01 · El teclado sale del modal
* **Causa raíz**: no existía gestión de foco; el primer Tab iba a la página y Mayús+Tab/Tab podían abandonar el diálogo.
* **Corrección** (`src/app.js`): un único `keydown` en captura en `window` que, con una capa modal visible (`#modal-root`, `[role=dialog]`, `[aria-modal=true]`), mete el primer Tab en la capa y cicla Tab/Mayús+Tab dentro de ella. Respeta las hojas anidadas porque trabaja sobre la capa más alta.
* **Pruebas**: `remediacion-03.js` UX-01 y UX-01b (Escape cierra y el foco vuelve); `flujos-ingresos.js` (69) y `adversarial.js` siguen en verde.

### UX-02 · Indicador de foco
* **Causa raíz**: reglas heredadas con `outline:none` y puntos de gráficos SVG focalizables sin estilo; los `input[type=month]` no activan `:focus-visible` en Chromium al entrar por teclado.
* **Corrección** (`src/styles.css`): `:focus-visible` con el acento dinámico (más claro en Black) para controles, `summary`, `[tabindex]` y elementos SVG; `:focus`/`:focus-within` para campos de fecha y mes.
* **Residual**: 2 paradas en el campo de búsqueda de la pantalla «Buscar» móvil (de 2 255). Pendiente de revisar si el indicador está en el contenedor.

### UX-03 · Nombre accesible
* **Causa raíz**: 26 plantillas de gráficos crean puntos/barras con `tabindex=0` y solo `data-chart-tip`.
* **Corrección** (`src/app.js`): al recibir el foco, el texto del globo pasa a `aria-label` y `role="img"` si no tenía.
* **Límite**: el nombre se asigna al enfocar, no en reposo; un lector que recorra sin foco (modo exploración) no lo verá hasta que se enfoque.

### H-01 · Servidor sin validación de contenido (preparado, **no aplicado**)
* **Reproducción** (Postgres 16 local con el esquema y funciones reales): con la definición vigente, `finance_apply_changes` acepta un saldo de 1e15.
* **Corrección** (`supabase/migrations/20261118000000_validacion_cambios_finanzas.sql`, reversión en `supabase/rollback/…down.sql`): antes de bloquear y escribir, exige un arreglo de ≤ 10 000 cambios y ≤ 16 MB y rechaza cualquier número con |valor| > 1e13. La operación sigue siendo atómica; firma, `SECURITY DEFINER`, `search_path` vacío, `lock_timeout` y permisos se conservan.
* **Verificación contra datos reales (solo lectura)**: máximo absoluto guardado hoy = 867 123 (1 271 números, 0 sobre el límite); 349 registros en total. La migración no rechazaría datos existentes.
* **Prueba** (`supabase/tests/finance_apply_changes.sql`, 15 comprobaciones): cambio válido, idempotencia del upsert repetido, conflicto 40001, rechazo de 1e15 y de importes anidados sin escribir ni cambiar la revisión (atomicidad), límite exacto 1e13 admitido, más de 10 000 cambios, forma inválida, eliminación, aislamiento RLS entre usuarios, ausencia de escritura directa, sin sesión (28000), `anon` sin ejecución y reversión.
* **Para aplicarla** (requiere tu autorización): `supabase db push` o aplicar el archivo con la herramienta de migraciones; la reversión deja el estado anterior.

### H-07 · Redondeo asimétrico (reclasificado)
* **Reproducción**: `rnd(-2.675)=-2.67` y `rnd(2.675)=2.68`; `rnd(-0.005)=0`.
* **Hallazgo**: `tests/logica/reglas.test.js` afirma explícitamente `rnd(-1.005) = -1` bajo «mitad hacia arriba, entradas inválidas = 0». Es una regla documentada, no una regresión. Se intentó simetrizar y se **revirtió** porque contradice la prueba aprobada (no se flexibilizan pruebas). `money()` ya muestra `RD$0.00` para `-0`.
* **Acción**: la regla queda protegida por `remediacion-03.js` H-07. Si el negocio quiere redondeo simétrico para devoluciones, hay que aprobarlo y cambiar prueba y código a la vez.

### H-20 (parcial) · Prueba SQL de vigencias
* `supabase/tests/reglas_vigentes.sql` se ejecutó por primera vez en Postgres 16 local: **todas las comprobaciones pasan** (vigencia retroactiva, update/delete bloqueados, disparador, anon sin acceso).

## 4. Pruebas ejecutadas (todas en verde tras los cambios)
| Suite | Resultado |
|---|---|
| `tests/remediacion-03.js` | 7/7 (antes: 5 fallaban) |
| `tests/flujos-ingresos.js` | 69 |
| `tests/adversarial.js` | sin hallazgos |
| `tests/smoke.js`, `csp.js`, `xss.js` | OK |
| `tests/rendimiento.js` | 6 |
| `tests/vive-score.js` | 39 |
| `tests/logica/run.js` | 256 paridades, 65 correctas, 0 errores JS |
| `supabase/tests/finance_apply_changes.sql` | 15 comprobaciones OK |
| `supabase/tests/reglas_vigentes.sql` | OK |
Comando de la prueba nueva: `node tests/remediacion-03.js` (acepta `TZID` y `FREEZE` en `tests/harness.js` para simular zona y fecha).

## 5. Archivos modificados
`src/app.js`, `src/styles.css`, `index.html` (versión de caché), `tests/harness.js` (zona y fecha simuladas), `tests/remediacion-03.js` (nuevo), `supabase/migrations/20261118000000_validacion_cambios_finanzas.sql`, `supabase/rollback/20261118000000_validacion_cambios_finanzas.down.sql`, `supabase/tests/finance_apply_changes.sql`, `docs/11-pruebas.md`.

## 6. Pendiente y por qué
| Hallazgo | Estado | Motivo |
|---|---|---|
| H-03 contraseñas filtradas | No aplicado | Es un ajuste del panel de Supabase Auth (Authentication → Policies); no se puede cambiar desde el código ni con las herramientas disponibles |
| H-01 | Migración lista | Aplicarla modifica producción; requiere autorización |
| H-04 límite de tasa en Edge Functions | No hecho | Requiere una tabla de contadores y desplegar funciones; ambas son operaciones en producción |
| H-12 sincronización | Parcial | El servidor ya tiene pruebas de revisión, conflicto, idempotencia y atomicidad; falta un Supabase simulado con revisiones para probar la reconciliación del cliente |
| H-02, H-08, H-10, H-11, H-14, H-16, H-17, H-18 | No hecho | Cambios grandes (centavos enteros, empaquetado y minificación, limpieza de capas, cifrado local, CI); no caben en modificaciones pequeñas y reversibles |
| UX-02 residual | 2 de 2 255 paradas | Campo de búsqueda móvil |

## 7. Acciones en producción (con autorización del usuario)
| Acción | Detalle | Verificación | Reversión |
|---|---|---|---|
| Migración `validacion_cambios_finanzas` | `finance_apply_changes` con límites de 10 000 cambios, 16 MB y ±1e13 | Consulta posterior a `pg_proc`: `SECURITY DEFINER`, `search_path` vacío, `lock_timeout=5s`, contiene la validación, `authenticated` puede ejecutar y `anon` no. Datos reales: máximo guardado 867 123, 0 valores sobre el límite | `supabase/rollback/20261118000000_validacion_cambios_finanzas.down.sql` |
| Despliegue `apple-pay-ingest` (v12 → **v13**) | Código del repositorio: límite de 30 eventos por minuto por vínculo, límite de 20 fallos de autenticación por minuto por origen, errores genéricos, sin CORS abierto | `get_edge_function` confirma que la versión 13 contiene el código nuevo | `supabase/rollback/apple-pay-ingest.v12.ts` |
| Despliegue `apple-pay-shortcuts` (v4 → **v5**) | Reenvía `X-Forwarded-For` del cliente original al receptor | Prueba nueva en `supabase/tests/shortcuts.test.mjs` (10/10) | `supabase/rollback/apple-pay-shortcuts.v4.ts` |
| `apple-pay-link` | **No desplegada** (v8 sigue activa) | — | — |
Hallazgos nuevos durante el despliegue:
* **Deriva confirmada**: el repositorio tenía versiones de las tres funciones distintas de las desplegadas (v8, v12 y v4); las del repositorio incluían límites de tasa y errores genéricos que no estaban en producción.
* **Fallo de diseño evitado antes de publicar**: el limitador de fallos del receptor agrupa por IP; las llamadas por el adaptador llegan con la IP de salida de Supabase, así que un atacante con tokens bien formados e inexistentes podía bloquear a todos los usuarios del adaptador. Se corrigió reenviando la IP original (despliegue del adaptador) y se probó.
* **Cambio de contrato visible**: el receptor responde `unauthorized` (antes `invalid_token`/`link_revoked`). La aplicación ya muestra el mensaje de vínculo revocado también para `unauthorized` (`src/app.js`).
* **Por qué `apple-pay-link` no se desplegó**: la versión del repositorio restringe CORS a `https://virgiliosmith.github.io`; el origen real de la aplicación no figura en el repositorio y, si fuera otro, «Vincular tarjeta» dejaría de funcionar. Confirma el origen y se despliega.
* **Verificación en vivo no realizada**: el proxy de esta sesión bloquea el tráfico saliente a `supabase.co`, así que no se pudieron enviar peticiones de humo a las funciones desplegadas; la verificación se hizo por el código desplegado y las pruebas locales (17 + 6 + 10). Recomendación: enviar una compra de prueba desde el iPhone y comprobar que llega a la bandeja.
* **Límite de la mejora**: el contador de fallos vive en la memoria de cada instancia de la función (mejor esfuerzo); no sustituye un limitador compartido.
