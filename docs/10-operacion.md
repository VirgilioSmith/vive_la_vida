# 10 · Operación

## Despliegue
1. Frontend: PR → `main` → GitHub Pages. Tras cambiar `src/styles.css`/`app.js` subir `?v=` en `index.html`.
2. Backend: migraciones SQL y funciones edge se aplican en el proyecto Supabase (no versionadas en el repo).

## Variables de entorno
| Variable | Dónde | Valor |
|---|---|---|
| `SUPABASE_URL` | Funciones edge (automática) | `<REDACTADO>` |
| `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEYS` | Funciones edge | `<REDACTADO>` |
El cliente no usa variables de entorno: URL y clave publicable están embebidas en `app.js:6849-6850`.

## Copias de seguridad
- Cliente: respaldo JSON exportable e importación (`app.js:2459` restauración, mensajes «Exporta un respaldo JSON»); punto de guardado `v30SavePoint`.
- Servidor: copias gestionadas por Supabase según el plan `[POR CONFIRMAR]` (no se pudo verificar PITR/frecuencia con las herramientas disponibles).

## Monitoreo
Logs de Supabase (API, Postgres, Edge, Auth) y asesores de seguridad/rendimiento. Consultas útiles: tráfico por ruta en `edge_logs`; errores 5xx en `function_edge_logs`.

## Procedimiento ante fallos
| Síntoma | Qué revisar |
|---|---|
| «Servidor temporalmente saturado» | Logs de API (503/504), pool de conexiones; el cliente pausa lecturas con espera creciente (`app.js:7843`) |
| Conflicto entre dispositivos | Los datos locales quedan protegidos (`v360WritePending`); resolver desde la app |
| Apple Pay no llega | Logs de `apple-pay-ingest`; token activo en `apple_pay_links`; estado Realtime |
| Pantalla de login sin entrar | Estado de Auth y de la biblioteca CDN (`app.js:7880`) |
