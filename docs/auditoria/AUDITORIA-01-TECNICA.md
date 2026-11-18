# AUDITORIA-01-TECNICA · vive el hoy

Fecha de la línea base: 2026-11-17 · Rama `main` · Fase de **investigación**: no se modificó código de la aplicación ni del backend. Todo lo marcado «Verificado» se reprodujo con un comando, una consulta de solo lectura o una prueba; lo marcado «Estático» sale de lectura/análisis de código sin ejecución; lo marcado «No verificado» se declara explícitamente.

## 1. Marco de referencia y método
| Norma | Cómo se aplicó |
|---|---|
| ISO/IEC 25010:2023 | Los hallazgos se etiquetan por característica: Adecuación funcional, Eficiencia, Fiabilidad, Seguridad, Mantenibilidad, Usabilidad/Accesibilidad, Compatibilidad |
| ISO/IEC/IEEE 29119 + ISTQB | Evaluación basada en riesgo (probabilidad × impacto), inventario de pruebas existentes, brechas por nivel (unitaria, integración, E2E, no funcional) |
| OWASP ASVS 5.0 | Capítulos de autenticación, control de acceso, validación, criptografía/almacenamiento, API y servicios |
| NIST SSDF (SP 800-218) | PO/PS/PW/RV: repositorio, revisión de código, dependencias, pruebas, respuesta a vulnerabilidades |
Técnicas: análisis estático con AST (acorn) sobre `src/app.js`, métricas del repositorio, consultas de solo lectura a Supabase (`pg_proc`, `pg_policies`, privilegios, asesores de seguridad y rendimiento), lectura del código de las 3 Edge Functions desplegadas, ejecución de las suites existentes y pruebas dinámicas con Playwright (medición de listeners con CDP, precisión monetaria, zona horaria).

## 2. Línea base objetiva
| Métrica | Valor | Estado |
|---|---|---|
| Commits / días activos | 399 en 5 días (13–17 nov 2026); autores: Claude 283, VirgilioSmith 116 | Verificado |
| Tamaño | `app.js` 2,61 MB (22 324 líneas) · `styles.css` 4,03 MB (56 165 líneas) · total servido ≈ 6,65 MB sin minificar | Verificado |
| Funciones | 1 130 declaradas; **38 nombres declarados más de una vez; 57 funciones reasignadas 90 veces** (p. ej. `render`×14, `onAction`×6, `loanForm`×6, `v40IncomeForm`×5) | Verificado (AST) |
| CSS | **38 643 `!important`**, 1 310 `@media`; capas por número de versión | Verificado |
| Eventos | 576 `addEventListener` (325 en `document`/`window`; 67 dentro de funciones) frente a 2 `removeEventListener`; 66 `MutationObserver` y 0 `disconnect()` | Verificado |
| Errores silenciados | ≈160 `catch` vacíos o `catch(_)` | Verificado |
| HTML dinámico | 321 `innerHTML` + 32 `insertAdjacentHTML`; 810 llamadas a `sanitize()`; 0 `eval`/`new Function` | Verificado |
| Dependencias | 1 de terceros (`vendor/supabase.js` 2.119.0, con hash SHA-384 coincidente); sin `package.json`, lockfile ni SBOM; Edge Functions importan `npm:@supabase/supabase-js@2` (versión mayor sin fijar) | Verificado |
| Integración continua | No existe `.github/`; 399 commits directos a `main`; 198 commits tocan `index.html` (versión de caché manual `?v=`, hoy `app.js?v=128`) | Verificado |
| Backend | 6 tablas (`finance_items` 349 filas, `finance_values` 10 605, `finance_revision`, `finance_collection_state`, `apple_pay_links`, `apple_pay_events`), RLS activo en todas, 3 funciones SQL, 3 Edge Functions | Verificado (consulta) |
| Pruebas existentes | Navegador: smoke, CSP, XSS, rendimiento (6), vive-score (39+12), flujos de ingresos (69), adversariales (≈36), pantallas sin scroll, auditoría y vitales; lógica: 256 paridades + 65 + 66 + 8 + 23 unitarias; Edge Functions: 17 + 6 + 9. **Todas pasan** | Verificado |
| Rendimiento (arnés, mediana de 3) | LCP móvil 5 592 ms / escritorio 6 256 ms (objetivo 2 500); CLS 0; INP móvil 80 ms / escritorio 240 ms (objetivo 200) | Verificado |
| Accesibilidad (axe, WCAG 2.2 AA) | Contraste: 122 (Claro) y 200 (Black) nodos antes de la auditoría previa; 11 y 71 tras ella | Verificado |

## 3. Arquitectura observada
* **Cliente**: PWA estática, un único IIFE de 22 k líneas; las funciones se redefinen por capas (el último override gana). El orden de carga define el comportamiento.
* **Datos**: estado completo en memoria (`db`), persistido en `localStorage` y sincronizado a Supabase en forma relacional aplanada (`finance_items` + `finance_values` en pares ruta/valor). Escritura mediante `finance_apply_changes(p_expected_revision, p_changes)` (concurrencia optimista por revisión global del usuario), lectura con verificación de revisión antes/después, fusión de tres vías y bloqueo de eliminaciones masivas sin confirmación. El sondeo cada 10 s se limita a 15 s, se pausa con la pestaña oculta y consulta primero solo `finance_revision`.
* **Servidor**: RLS por `auth.uid()`; `authenticated` solo tiene `SELECT` directo sobre las tablas financieras y escribe únicamente por RPC. Apple Pay: enlace por JWT del usuario, ingestión por token (hash SHA-256) con idempotencia por `event_id`.
* **Código heredado**: 8 referencias a la tabla inexistente `finanzas_estado` y un canal Realtime heredado (`finanzas360-direct-`) conviven con el flujo vigente.

## 4. Matriz de trazabilidad
Requisito → riesgo principal → componentes → pruebas existentes → brecha. (RF = requisito funcional; RNF = no funcional)
| Funcionalidad | Requisito | Riesgo principal (hallazgo) | Componentes | Pruebas existentes | Brecha |
|---|---|---|---|---|---|
| Registro de gasto/ingreso/transferencia | RF: un movimiento por operación; saldo coherente | Doble envío, redondeo (H-07, H-08) | `transactionForm`, `v40IncomePost`, `persist` | smoke; `rendimiento.js`; `logica/app.js`; `recorrido-registrar.js` | Sin prueba de conciliación de saldos con muchos movimientos mixtos DOP/USD |
| Ingreso recurrente / cobro / salario | RF: cobro parcial, anticipado y adicional sin duplicar | Dobles toques, Enter (corregidos), zona horaria (H-09) | `v40IncomeForm`, `v901CobroSteps`, `v940CaptureIncome` | `flujos-ingresos.js` (69), `adversarial.js` | Sin prueba de reglas de nómina vigentes frente a la ley |
| Catálogo de categorías | RF: no duplicar, no alterar movimientos | — | `categoryForm`, `v900CatSync` | `flujos-ingresos.js` 15–17b, `adversarial.js` F | — |
| Tarjetas, préstamos, certificados | RF: intereses, cortes, pagos mínimos | Aritmética en coma flotante (H-08) | `src/lib/finanzas/reglas.js`, módulos de tarjetas | `logica/reglas.test.js` (23), `paridad.js` (256) | Pocas pruebas por escenario de borde de vencimientos |
| Sincronización multi-dispositivo | RNF: sin pérdida ni duplicación | Conflictos, fusión de tres vías (H-12) | `v405Read/Commit/Reconcile`, `v10PullRemote` | **Ninguna automática** (el mock devuelve constantes) | Crítica |
| Seguridad de datos por usuario | RNF: aislamiento (ASVS V4) | Validación servidor (H-01) | RLS, `finance_apply_changes` | **Ninguna automática** (`reglas_vigentes.sql` requiere Postgres local, no ejecutado) | Crítica |
| Apple Pay | RF: idempotencia, moneda coincidente | Sin límite de tasa (H-04) | 3 Edge Functions | 32 pruebas en `supabase/tests` | Sin pruebas contra función desplegada |
| Vive Score | RF: reglas de puntuación | — | `src/vive-score/*` | 39 + 12 | — |
| Accesibilidad | RNF: WCAG 2.2 AA | Contraste, objetivos táctiles (H-13) | CSS en capas | `auditoria-recorrido.js` (axe) | Sin ejecución continua |
| Rendimiento | RNF: LCP ≤ 2,5 s | Peso 6,65 MB (H-10) | `app.js`, `styles.css` | `rendimiento*.js` | Sin presupuesto en CI |
| Mantenibilidad | RNF: cambios sin regresión | Overrides y `!important` (H-11) | Todo `src/` | Suite E2E amplia | Sin comparación visual |

## 5. Hallazgos
Escala: Severidad P0–P4 (P0 seguridad/integridad financiera … P4 deuda). Probabilidad y Impacto: B/M/A. Criticidad financiera: Ninguna / Baja / Media / Alta.

| ID | Hallazgo | Sev. | Prob. | Imp. | Crit. fin. | Causa raíz | Evidencia |
|---|---|---|---|---|---|---|---|
| H-01 | `finance_apply_changes` acepta cualquier JSON del usuario autenticado: sin validación de tipos, rangos, esquema ni tamaño de `p_changes`; los importes, saldos y deudas no tienen restricciones de integridad en servidor | **P1** | M | A | **Alta** | El servidor es un almacén genérico ruta/valor; toda la lógica financiera vive en el cliente | Código de la función (consulta `pg_proc`): solo verifica sesión, revisión y longitud de ids |
| H-02 | Escritura de `finance_values` por reemplazo completo del registro (DELETE + INSERT del árbol) bajo bloqueo de la revisión del usuario; amplificación de escritura (≈30 filas por registro) y un único bloqueo por usuario | P2 | M | M | Media | Modelo aplanado de documento | `finance_write_item`; 10 605 filas / 349 registros |
| H-03 | Protección contra contraseñas filtradas desactivada | **P1** | M | A | Alta | Configuración de Auth | Asesor de seguridad (WARN) |
| H-04 | Edge Functions con `verify_jwt=false` y `Access-Control-Allow-Origin: *`; sin límite de tasa en ingestión ni en emisión de tokens; filas de `apple_pay_events` sin tope por usuario | P2 | B | M | Media | Autenticación propia por token; falta control de abuso | Código desplegado de las 3 funciones. Mitigación existente: token de 256 bits con hash, validación de moneda, límite de 16 KB, idempotencia |
| H-05 | `finance_apply_changes` es `SECURITY DEFINER` ejecutable por `authenticated` | P4 (informativo) | B | B | Baja | Diseño intencionado: usa `auth.uid()`, `search_path` vacío y `lock_timeout`; `finance_write_item` y `apple_pay_remove_link` no son ejecutables por `anon` ni `authenticated` | Asesor WARN + consulta de privilegios |
| H-06 | Políticas sin privilegio correspondiente (UPDATE en `apple_pay_events`; INSERT/UPDATE en `finance_collection_state`) y 4 índices sin uso | P4 | B | B | Ninguna | Evolución del esquema | `pg_policies`, `role_table_grants`, asesor de rendimiento |
| H-07 | Redondeo monetario asimétrico y silencioso: `rnd(2.675)=2.68` pero `rnd(-2.675)=-2.67`; `rnd(NaN)=0` oculta importes inválidos | P2 | M | B (1 centavo) | Media | Redondeo medio-hacia-arriba sin simetría; coerción de `NaN` a 0 | Ejecución real de `window.__T.fn.rnd` |
| H-08 | Aritmética de coma flotante sobre importes: 245 operaciones `*` y `/` sobre importes/tasas y 268 `toFixed`; el servidor guarda `numeric`, el cliente usa `Number` | P2 | M | M | Media | No hay tipo monetario ni centavos enteros | AST + conteo |
| H-09 | Dos criterios de «hoy»: `today()` usa la zona del producto (`America/Santo_Domingo`) pero `dateStr()` y 34 usos de `new Date().getFullYear/Month/Date()` usan la zona del dispositivo; con dispositivo en otra zona la fecha difiere un día cerca de medianoche | P2 | B | M | Media | Convivencia de utilidades de distintas épocas | Prueba con `timezoneId`: a las 02:30 UTC del 18-nov, Santo Domingo = 17-nov, Auckland (local) = 18-nov |
| H-10 | Peso y arranque: 6,65 MB sin minificar ni comprimir; LCP 5,6–6,3 s en el arnés; INP de escritorio 240 ms | P2 | A | M | Ninguna | Monolito y CSS en capas; sin empaquetado | `rendimiento-web-vitals.js` (mediana de 3) |
| H-11 | Capas de sobrescritura: 57 funciones reasignadas 90 veces, 38 nombres duplicados, 38 643 `!important` y 1 310 `@media`; para vencer la especificidad hay que apilar `#modal-root#modal-root#modal-root` | P3 | A | A | Media (riesgo de regresión) | Parches por versión sin retirar la capa anterior | AST + conteo CSS |
| H-12 | Sincronización sin pruebas automáticas: el mock de Supabase devuelve valores constantes; no hay pruebas de conflicto, fusión de tres vías, reintentos ni reconexión | **P1** (brecha de pruebas) | M | A | **Alta** | Dependencia del servidor real | `tests/mock.js` (`rpc` devuelve `revisión+1`) |
| H-13 | Accesibilidad residual: ≈11 (Claro) y ≈71 (Black) nodos de contraste, parte falsos positivos de axe con `color-mix`; 1 caso `aria-hidden-focus` sin localizar | P3 | M | B | Ninguna | Colores fijos por capa | `auditoria-recorrido.js` |
| H-14 | Datos financieros en `localStorage` sin cifrar (49 usos: estado completo, cola de operaciones, documento pendiente); si falla la CSP o hay XSS o acceso físico, quedan expuestos. No se verificó si el cierre de sesión borra todas las claves | P2 | B | A | Alta | Persistencia local para el modo sin conexión | AST/grep; `f33Logout` protege cambios pendientes antes de salir |
| H-15 | Fuga de listeners: `v1110BankPicker` agrega un `keydown` a `document` por instancia y no lo retira (medido: +10 listeners tras abrir y cerrar 10 veces el asistente de ingreso); los otros flujos medidos (catálogo, gasto, transacción) no filtran. Quedan 66 observers sin `disconnect()` y 67 listeners globales dentro de funciones sin medir | P3 | A | B | Ninguna | CDP `DOMDebugger.getEventListeners` antes y después |
| H-16 | ≈160 `catch` vacíos o `catch(_)` ocultan fallos (incluidos de persistencia y sincronización) | P3 | M | M | Media | Estilo defensivo sin registro | AST/grep |
| H-17 | Código muerto heredado: 8 referencias a `finanzas_estado` (tabla que no existe) y un canal Realtime `direct` anterior; el flujo vigente lo sobrescribe, pero el código sigue cargándose | P4 | B | B | Ninguna | Capas no retiradas | `list_tables` + grep |
| H-18 | Proceso: sin CI, sin revisión de código ni protección de rama (399 commits directos a `main`), versión de caché manual, dependencias sin SBOM ni versión fija en las funciones | P3 | A | M | Media | Ritmo de entrega y ausencia de automatización | Repositorio |
| H-19 | Documentación desfasada: `docs/11-pruebas.md` y `docs/12-deuda-tecnica.md` afirman que no hay pruebas ni repositorio de Edge Functions, y hoy existen 32 pruebas y `supabase/` | P4 | A | B | Ninguna | Falta de actualización | Lectura de docs frente a los archivos |
| H-20 | La suite de navegador no incluye pruebas contra un Supabase real ni contra una rama de pruebas; la prueba SQL de vigencias requiere Postgres local y no se ejecutó | P2 | M | A | Alta | Falta de entorno de integración | `tests/mock.js`; `supabase/tests/reglas_vigentes.sql` |

### Fortalezas verificadas (para equilibrar la línea base)
RLS activo con `auth.uid()` en las 6 tablas y escritura solo por RPC; concurrencia optimista con revisión y fusión de tres vías; guarda contra eliminaciones masivas; límite y pausa del sondeo; CSP estricta sin `unsafe-eval` y vendor con hash; cierre de sesión por inactividad (30 min); idempotencia de Apple Pay con detección de conflicto de `event_id`; `today()` independiente de la zona del dispositivo.

## 6. Riesgos de regresión
1. **Orden de carga** (H-11): reordenar o eliminar una capa cambia el comportamiento sin error visible.
2. **Especificidad CSS**: cualquier regla nueva puede ser sobrescrita por una antigua con `!important`.
3. **Cambios de esquema** (H-01): una validación en servidor puede rechazar datos válidos existentes si no se mide antes contra los 349 registros reales.
4. **Pruebas que simulan el servidor** (H-12, H-20): los cambios de sincronización no tienen red de seguridad.

## 7. Orden sugerido para la fase siguiente
P1: H-03, H-01, H-12 (con entorno de integración H-20) · P2: H-07/H-08 (centavos enteros), H-09, H-14, H-10, H-04, H-02 · P3: H-11, H-13, H-15, H-16, H-18 · P4: H-05, H-06, H-17, H-19.

## 8. Alcance y limitaciones
* No se ejecutó ninguna operación que modifique datos; las consultas a Supabase fueron de solo lectura sobre catálogo del sistema y asesores.
* La prueba SQL de vigencias, la conciliación del código desplegado de las Edge Functions con el repositorio, la verificación del borrado de `localStorage` al cerrar sesión y el recuento de canales Realtime en ejecución **no se verificaron**.
* Las mediciones de rendimiento provienen de un arnés Playwright con Supabase simulado; sirven como línea base comparable, no como medición de campo.
* Los números de líneas y conteos corresponden a `main` el 2026-11-17 (`app.js?v=128`).

## 9. Reproducción
```
node docs/auditoria/analisis-ast.js    # análisis AST (requiere npm i acorn acorn-walk)
node tests/rendimiento-web-vitals.js # vitales
AXE=/ruta/axe.min.js node tests/auditoria-recorrido.js
node --test supabase/tests/ingest.test.mjs supabase/tests/link.test.mjs supabase/tests/shortcuts.test.mjs
node tests/logica/run.js && node --test tests/logica/reglas.test.js tests/logica/red.test.js
```
