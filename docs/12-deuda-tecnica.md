# 12 · Deuda técnica (priorizada)

| # | Prioridad | Hallazgo | Evidencia |
|---|---|---|---|
| 1 | Alta | Monolito de ~21.000 líneas sin módulos ni tipos | `src/app.js` |
| 2 | Alta | CSS de ~54.600 líneas con ~37.000 `!important` y capas por versión | `src/styles.css` |
| 3 | Alta | Sin pruebas de reglas financieras, RLS ni funciones edge | [11](11-pruebas.md) |
| 4 | Alta | Backend no versionado: sin migraciones ni código de funciones en el repo | ausencia de `supabase/` |
| 5 | Media | Sin SRI/CSP; dependencia de CDN | `index.html:35` |
| 6 | Media | Sobrescritura de funciones por versión (`v10PullRemote=…`, `app.js:7815`) | `app.js:7815-7900` |
| 7 | Media | Totales recalculados en varias pantallas con funciones distintas | [05](05-modelo-de-datos.md) |
| 8 | Media | Privilegios amplios para `anon` y `TRUNCATE` | [07](07-seguridad.md) |
| 9 | Media | Sin CI ni protección de rama; caché manual `?v=` | `index.html:36` |
| 10 | Baja | Referencias a la tabla inexistente `finanzas_estado` en rutas heredadas | `app.js:6844-7010` |
| 11 | Baja | Peso de carga (~6,3 MB sin minificar) | tamaños de archivo |
