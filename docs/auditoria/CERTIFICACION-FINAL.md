# Informe consolidado — estado final (2026-11-18)

## Veredicto
**GO condicionado (certificación interna parcial; no es una certificación oficial).** No hay defectos críticos, discrepancias financieras ni regresiones conocidas pendientes, y la batería automática completa pasa sobre la versión final. No se cumple el criterio «100 % del inventario evaluado» porque las pruebas que exigen un iPhone físico y el Supabase real **no se ejecutaron** (ver «No verificado»). Esas pruebas deben pasar antes de dar la certificación por completa.

## Autenticación (prioridad)
- **Causa raíz:** (1) cierre automático por inactividad a los 30 min (al volver a la app tras >30 min cerraba la sesión); (2) `getUser()` consultaba la red en cada arranque y cualquier fallo temporal mostraba el acceso.
- **Corrección:** gestión única de sesión (`f33Boot`, `authEscuchar`): `getSession()` local con renovación automática, `storageKey` explícito, cliente único, espera de 8 s y pantalla «No pudimos conectar» con reintentos escalonados que **nunca** cierra la sesión; solo termina por «Cerrar sesión» o revocación del servidor. Se retiró el cierre por inactividad (decisión en `docs/DECISIONES.md`).
- **Evidencia:** `tests/auth-sesion.js`, 16 comprobaciones con el **cliente real de Supabase** y un servidor de autenticación simulado: reabrir, recargar, nueva pestaña, token vencido con renovación, red caída y 500 (se conserva y se recupera), +3 h de inactividad, bloqueo/desbloqueo, `pageshow` con caché, recorrido de los 18 módulos y Ajustes, revocación en caliente (vuelve al acceso), cierre voluntario. La versión anterior fallaba 5 de 15.
- **Riesgo residual:** sin cierre por inactividad, un dispositivo compartido desbloqueado conserva la sesión; mitigable con caducidad de refresh token en Supabase Auth (configuración del proyecto, no verificada).

## Código eliminado y archivos
- `src/app.js`: 22 299 → 21 971 líneas (2 435 533 → 2 404 873 bytes) **neto, tras añadir** el módulo de Suscripciones (~500 líneas) y la gestión de sesión; eliminado en bruto: cadena heredada de Suscripciones, 9 implementaciones sustituidas, ~40 funciones sin alcance, 35 manejadores de acción sin origen, 22 variables sin uso.
- `src/styles.css`: 55 566 → 54 375 líneas (4 006 519 → 3 940 631 bytes): −1 097 reglas muertas verificadas pixel a pixel (73/76 capturas estables idénticas; el resto varía entre ejecuciones idénticas).
- Tests: retirados 2 scripts de captura huérfanos; añadidos 9 (`auth-sesion`, `detalles`, `suscripciones`, `red-team-*`).
- Sin dependencias npm en el proyecto; sin referencias a Netlify (solo dentro del `vendor/supabase.js` de terceros); sin código comentado ni TODO; recursos de `assets/` y `vendor/` con consumidor.
- **Error propio detectado por revisión independiente:** la limpieza eliminó `accountDetail`/`loanDetail` (y 11 auxiliares) que un envoltorio reutilizaba; el detalle de cuentas y préstamos lanzaba una excepción. Restaurado y cubierto por `tests/detalles.js`. Lección: la prueba dinámica de «no se invoca» solo vale para rutas recorridas.

## Bugs corregidos en esta fase
Autenticación (arriba); tope de importes 9 999 999 999 (cliente y respaldos; el servidor rechaza >1e13); carga con listas vacías; fusión entre dispositivos con respuesta perdida y con dos pestañas; importación de respaldo JSON que no hacía nada tras confirmar; fuga de ~880 nodos/oyentes por apertura del formulario de gasto/ingreso; cabecera a 320 px; contrastes WCAG AA; acceso rediseñado; marca plana. Nuevo módulo de Suscripciones (Agenda, Cartera, Historial, Análisis).

## Pruebas ejecutadas (versión final, todas aprobadas)
auth-sesion 16 · detalles 3 · smoke · adversarial · remediacion-03 · experiencia-04 · csp · xss · vive-score 39 · suscripciones 36 · red-team-seguridad 17 · red-team-caos 43 (offline, 401/403/429/500/503, respuesta perdida, 2 pestañas) · red-team-carga 7 (20 000 movimientos, 30 ciclos sin crecimiento de DOM ni oyentes) · red-team-visual (4 anchos × Claro/Black × texto 150 %) · auditoría de 54 pantallas sin error/desborde/NaN · flujos-ingresos 69 · selectores-universales (41 formularios, 0 incompletos) · editar-movimientos · lógica financiera (23 unitarias + paridad) · red-team-monkey (semillas 11 y 12, 390 y 1440 px) · red-team-financiero 28 (exactitud al centavo, idempotencia, conservación DOP/USD) · Apple Pay: 33 pruebas unitarias (ingest 17, link 6, shortcuts 10).

## Supabase (asesores del proyecto, solo lectura)
Seguridad: protección de contraseñas filtradas desactivada (ajuste manual en Auth, pendiente); `finance_apply_changes` ejecutable por `authenticated` (intencional, valida `auth.uid()`). Rendimiento: 4 índices sin uso en tablas de Apple Pay (tablas pequeñas; se conservan). RLS activo en las 6 tablas.

## Accesibilidad
axe (WCAG 2.2 AA) en 54 pantallas Claro: 15 nodos → 2 restantes (iniciales de banco blancas sobre blanco, ocultas bajo el logo). Modo Black y lector de pantalla no medidos.

## No verificado (bloquea la certificación completa)
- iPhone/Safari/PWA físico: cierre y reapertura reales, bloqueo, cambio de aplicación, bfcache, `refresh_token_already_used` entre PWA y Safari.
- Supabase real: aislamiento RLS entre usuarios con dos cuentas de prueba, límites del RPC, Realtime en vivo, caducidad de refresh token.
- Apple Pay de extremo a extremo con Wallet real (solo pruebas unitarias).
- axe en modo Black; regresión visual contra mockups más allá de las comparaciones realizadas.
- Una sola revisión independiente (un agente nuevo); la revisión no cubre commits anteriores a `fab6b4b`.

## Riesgos residuales
Capas de sobrescritura (39 funciones envueltas) y un `styles.css` de ~3,9 MB con ~8 % de uso por pantalla: deuda técnica de rendimiento sin consolidar. Sin cierre por inactividad (decisión de producto). Contraseñas filtradas sin activar.
