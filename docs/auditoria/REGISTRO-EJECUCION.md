# Registro de ejecución — protocolo de ingeniería autónoma

Estado vivo: se actualiza tras cada microtarea verificada. Reanudar siempre desde la última microtarea marcada ✔.

## Línea base (2026-11-18)
- 267 archivos versionados; `src/app.js` 22 400 líneas (IIFE con capas de sobrescritura), `src/styles.css` 56 256 líneas, módulo `src/vive-score/*` 1 100 líneas.
- 1 230 declaraciones de función en `app.js`; 38 nombres declarados en más de un ámbito; 57 funciones sobrescritas por asignación (override); 69 `addEventListener` globales dentro de funciones; 7 `setInterval`.
- Pruebas: smoke, adversarial, remediacion-03, experiencia-04, csp, xss, vive-score, lógica (23 unitarias + paridad), selectores universales (41 formularios, 0 sin selector, 0 incompletas), flujos de ingresos (69).

## Microtareas
| # | Fase | Microtarea | Estado | Evidencia |
|---|------|------------|--------|-----------|
| 1 | 1 | Inventario y línea base | ✔ | cifras anteriores |
| 2 | 2 | Funciones sin consumidores / sobrescritas en el mismo ámbito (AST) | ✔ 0 hallazgos | 1 230 funciones analizadas; 0 inalcanzables por duplicado en el mismo ámbito; 0 sin referencia (incluye `index.html`, `src/*`, `tests/*` y referencias por cadena) |
| 3 | 2–3 | Variables sin ninguna lectura ni escritura | ✔ 20 declaraciones (103 líneas) eliminadas | `docs/auditoria/codigo-muerto.js`; suite verde tras el cambio |
| 4 | 2–3 | Recursos gráficos y scripts huérfanos | ✔ | los 6 recursos de `assets/` y `vendor/` tienen consumidores; se eliminan `tests/_black.js` y `tests/_sel.js` (solo capturas de pantalla, sin aserciones ni referencias en el repositorio) y `tests/editar-movimientos.js` se añade al ejecutor `ejecutar-todo.sh` (no se ejecutaba) |
| 5 | 2–3 | CSS muerto (selectores de nivel superior con clase/id inexistente en HTML/JS) | ✔ 352 reglas (47 792 bytes, −1,2 %) | 53 de 56 pantallas estables idénticas píxel a píxel antes/después (14 páginas × Claro/Black × 390/1440 px, `FREEZE`); 8 pruebas verdes |

### Incidente de la microtarea 3 (corregido)
La primera versión del análisis no contaba las asignaciones como uso (`acorn-walk` visita el lado izquierdo como patrón). Se eliminó `lastModal`, que aún se escribía, y la prueba `adversarial` falló 3 comprobaciones («lastModal is not defined»). Se revirtió el archivo, se corrigió el análisis para contar escrituras y se repitió: 20 declaraciones (no 21) y la suite quedó verde. Las variables que solo se escriben se conservan (89 candidatas sin lecturas, 34 de inicialización pura; 20 eliminadas por seguridad de inicializador).

## Próxima acción
Microtarea 6: listeners globales y `setInterval` dentro de funciones (69 y 7): comprobar duplicación al reabrir pantallas con una prueba de conteo de listeners; luego CSS sin selectores vivos (medido con cobertura de Chromium) y fase 5 financiera.

### Incidente de la microtarea 5 (corregido)
El primer análisis contaba también las clases dentro de `:not()` e `:is()`. Eliminó 869 reglas (202 094 bytes) pero la comparación de píxeles detectó 53 pantallas distintas: se habían borrado reglas de paleta/tema (`body[data-vive-palette] :is(…)`) cuyas clases ausentes estaban dentro de `:not()`. Se revirtió el archivo, se restringió el criterio a clases del nivel superior del selector y se repitió: 352 reglas, 0 diferencias. Sin la comparación de píxeles el error habría llegado a producción: las pruebas funcionales (8 suites) pasaban en ambos casos.

### Medición (no es hallazgo aún)
Cobertura de CSS de Chromium recorriendo 17 pantallas: `styles.css` pesa ~4 MB y solo se usa ~8–9 % en esas pantallas (sin modales ni otros estados). Es el principal riesgo de rendimiento del cliente (parseo/transferencia). Reducirlo exige una consolidación de las capas de sobrescritura (`!important`, `#app#app`), no una poda estática; queda propuesto en la fase 6.
