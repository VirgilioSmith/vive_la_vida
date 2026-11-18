# Red team — matriz de resultados

Entorno: local y aislado (Chromium + servidor Supabase simulado en memoria `tests/lib-servidor.js`), datos sintéticos, sin producción ni red externa.
Los números son de la última ejecución registrada en `REGISTRO-EJECUCION.md`; todo lo marcado «no ejecutada» o «bloqueada» no se ha verificado.

## Hallazgos (defectos reproducidos y corregidos)

| ID | Funcionalidad | Escenario | Esperado | Obtenido (antes) | Sev. | Causa raíz | Corrección | Revalidación |
|----|---------------|-----------|----------|------------------|------|------------|------------|--------------|
| D1 | Movimientos | Importe `9999999999999999999999999` en el formulario | Rechazo con mensaje | Se guardaba 1e25; el servidor rechaza |valor| > 1e13, la sincronización quedaría bloqueada | Alta | Sin tope en `saveTx` | `MAX_MONEY` (9 999 999 999) en `saveTx` y en `v30ValidateImport` (respaldos) | `red-team-financiero` F1; `red-team-seguridad` S-importe-absurdo-b |
| D2 | Carga de datos | Usuario sin movimientos/cuentas en el servidor | Carga normal | «No pudimos cargar tus datos» (las listas vacías no se guardan como filas) | Alta | `f33Prepare` exigía `accounts`/`transactions` | Se tratan como `[]` | `red-team-caos` C11/C12 (segunda pestaña carga) |
| D3 | Sincronización | Respuesta perdida tras aplicarse en el servidor | Converge sin intervención | Conflicto permanente («Conflicto entre dispositivos») | Alta | La fusión de tres vías comparaba con `JSON.stringify` sensible al orden de claves | Comparación canónica (claves ordenadas) | `red-team-caos` C9 |
| D4 | Sincronización | Dos pestañas añaden movimientos distintos a la vez | Ambos se conservan | Una pestaña quedaba en conflicto | Alta | Colecciones vacías ausentes en la base remota no se fusionaban | `fill` de listas vacías en `v360ThreeWayMerge` | `red-team-caos` C11a/b |
| D5 | Respaldo JSON | Importar un respaldo válido y confirmar | Se restaura | No hacía nada (el diálogo repite el evento y el campo ya estaba vacío) | Alta | `t.value=''` antes de confirmar + V1011 | Se conserva el archivo (`__v30PendingImport`) hasta terminar | `red-team-seguridad` S-control |
| D6 | Rendimiento | 18 aperturas de modales (gasto/ingreso) | DOM estable | +880 nodos y +23 oyentes por apertura (fuga) | Media | `document.addEventListener('click')` en el selector universal nunca se retiraba | Oyente en el modal | `red-team-carga` L4a–c (4 028 nodos constantes en 30 ciclos) |
| D7 | Móvil 320 px | Cabecera | Botones visibles | Engranaje 24 px fuera de pantalla en todas las pantallas | Media | La fecha junto al logo ocupaba el ancho | Fecha oculta ≤ 350 px | `red-team-visual` V1 |

## Pruebas por familia

| Familia | Prueba | Alcance | Resultado |
|---------|--------|---------|-----------|
| Funcional/monkey | `red-team-monkey.js` (semilla) | 8 semillas × 390/1440 px × 500 pasos = 8 000 acciones aleatorias; invariantes: sin NaN/Infinity, sin XSS, sin excepciones, sin modales apilados, sin desborde | aprobada (0 hallazgos reales; «NaN» escrito por el propio mono y «Infinite / Infinity» se excluyen como eco/etiqueta) |
| Financiera | `red-team-financiero.js` | 28 comprobaciones: importes inválidos/extremos, exactitud al centavo, triple envío, transferencias (misma cuenta, DOP→DOP, DOP→USD), fechas inválidas, 300 operaciones aleatorias con semilla, pagos excesivos | aprobada tras D1 |
| Caos + concurrencia | `red-team-caos.js` | 43 comprobaciones: offline, 401, 403, 429, 500, 503, respuesta incompleta/basura, respuesta perdida, latencia 2,5 s, 2 pestañas, edición simultánea del mismo registro, sesión expirada con 6 cambios | aprobada tras D2–D4 |
| Carga / larga duración | `red-team-carga.js` | 20 000 movimientos + 40 cuentas; render ≤ 1,5 s por pantalla; 30 ciclos × 18 pantallas con modales | aprobada tras D6 |
| Visual | `red-team-visual.js` | 4 anchos × Claro/Black × texto 100/150 % × 18 pantallas + 2 modales, datos extremos | aprobada tras D7 |
| Seguridad (cliente) | `red-team-seguridad.js` | 11 respaldos hostiles (prototipo, tipos, importes, HTML, nulos, binario, anidación 3 000) + control positivo; almacenamiento sin secretos | aprobada tras D1/D5 |

## Limitaciones declaradas (no verificado)
- **No ejecutada:** pruebas contra Supabase real (aislamiento RLS entre usuarios, límites del RPC), Realtime en vivo, Safari/iOS real, accesibilidad con lector de pantalla.
- **Diseño conservador (no es defecto):** la edición simultánea del mismo movimiento en dos dispositivos produce un conflicto visible y protegido (no se fusiona por campos). Verificado en `red-team-caos` C12.
- **Informativo:** con importes de 11 cifras a 320 px algunas cifras se abrevian con «…».
- El servidor simulado reproduce la lógica del RPC `finance_apply_changes`; no sustituye una prueba contra la base real.
