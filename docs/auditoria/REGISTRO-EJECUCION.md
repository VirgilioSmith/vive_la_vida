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

### Incidente de la microtarea 3 (corregido)
La primera versión del análisis no contaba las asignaciones como uso (`acorn-walk` visita el lado izquierdo como patrón). Se eliminó `lastModal`, que aún se escribía, y la prueba `adversarial` falló 3 comprobaciones («lastModal is not defined»). Se revirtió el archivo, se corrigió el análisis para contar escrituras y se repitió: 20 declaraciones (no 21) y la suite quedó verde. Las variables que solo se escriben se conservan (89 candidatas sin lecturas, 34 de inicialización pura; 20 eliminadas por seguridad de inicializador).

## Próxima acción
Microtarea 5: listeners globales y `setInterval` dentro de funciones (69 y 7): comprobar duplicación al reabrir pantallas con una prueba de conteo de listeners; luego CSS sin selectores vivos (medido con cobertura de Chromium) y fase 5 financiera.
