# Documentación técnica · Vive el Hoy Finanzas 360

> Documento descriptivo: refleja el sistema **tal como existe hoy**. Las correcciones y mejoras se tratan en otros trabajos.
> Convención de citas: `archivo:línea` (líneas del estado de la rama principal el 14-nov-2026). Lo que no se puede verificar en el código se marca **`[POR CONFIRMAR]`**. Claves, tokens y URLs privadas aparecen como `<REDACTADO>`.
> **Nota sobre la versión:** el encargo habla de «V183»; el código y el historial llegan a la etiqueta interna **V1044** (`git log`), y el título visible de la app no muestra número de versión. Se documenta el estado actual del repositorio. `[POR CONFIRMAR]` a qué hito corresponde «V183».

## Guía de lectura
| Si quieres… | Lee |
|---|---|
| Entender para qué sirve | [01](01-proposito-y-objetivo.md), [02](02-alcance.md) |
| Ver cómo encaja todo | [03](03-arquitectura.md), [08](08-flujos.md) |
| Conocer cada pantalla | [04](04-modulos.md) |
| Ver datos y servidor | [05](05-modelo-de-datos.md), [06](06-api-y-funciones.md) |
| Evaluar riesgos | [07](07-seguridad.md), [12](12-deuda-tecnica.md) |
| Operar y desplegar | [09](09-metodologia-y-herramientas.md), [10](10-operacion.md), [11](11-pruebas.md) |
| Historial | [CHANGELOG](CHANGELOG.md) |

## Documentos previos que se conservan
`AVANCE.md` (notas de avance del registro), `CATALOGO.md` (catálogo de componentes y calificación), `SUPABASE.md` (estado verificado del backend y consumo).

## Cifras del repositorio
| Dato | Valor | Evidencia |
|---|---|---|
| Archivos de la aplicación | `index.html` (38 líneas), `app.js` (~21.100 líneas), `styles.css` (~54.600 líneas) | `wc -l` |
| Commits / merges | 250 / 140 | `git log` |
| Rango de fechas | 13–14 nov 2026 | `git log --date=short` |
