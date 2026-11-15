# Resultado de la auditoría de seguridad (V183 → rama `security/hardening-v183`)

| ID | Hallazgo | Estado | Razón / prueba |
|---|---|---|---|
| S1 | `anon` con privilegios de escritura/TRUNCATE | **Resuelto (producción)** | Migración aplicada; consulta de privilegios: solo `authenticated SELECT`; `pruebas_rls.sql`: «anon sin acceso» |
| S2 | Escritura directa de usuarios en `finance_*` | **Resuelto (producción)** | Prueba antes/después: insert/update/truncate directos bloqueados, RPC OK, conflicto 40001 detectado |
| S3 | `finance_write_item` invocable | **Resuelto (producción)** | `EXECUTE` revocado; prueba «write_item directo bloqueado» |
| E1 | Sin límite de tasa en ingesta | **Resuelto en código · pendiente de despliegue** | `supabase/tests/ingest.test.mjs` (429 por vínculo y por origen). Despliegue: `DESPLIEGUE.md` |
| E2 | Respuestas distintas de autenticación | **Resuelto en código · pendiente de despliegue** | Prueba: sin token, token falso y vínculo revocado devuelven el mismo 401 sin detalles |
| E3 | CORS `*` | **Resuelto en código · pendiente de despliegue** | Pruebas de cabeceras; `apple-pay-link` solo permite el origen de GitHub Pages |
| E4 | Errores con detalle interno | **Resuelto en código · pendiente de despliegue** | Pruebas «500 genérico sin filtrar detalle» (también en logs) |
| E5 | Sin captura global | **Resuelto en código · pendiente de despliegue** | Pruebas de excepción inesperada → 500 JSON |
| — | Idempotencia de compras duplicadas | **Verificada** | Pruebas: repetición, carrera concurrente y conflicto de `event_id` (409) |
| F1 | Sin CSP | **Resuelto** | `tests/csp.js`: 0 violaciones en 20 pantallas × 2 formatos |
| F2 | Biblioteca sin SRI | **Resuelto** | Biblioteca local; hash SHA-384 registrado; `npm audit` 0 vulnerabilidades |
| F3 | Scripts en línea | **Resuelto** | `src/early.js` |
| F4 | XSS por `innerHTML` | **Mitigado** | `tests/xss.js`: 4 cargas × 22 pantallas × 7 modales × 2 formatos sin ejecución ni inyección. No se auditaron las ~257 interpolaciones una a una; la defensa es `sanitize` + CSP |
| F5 | Referrer | **Resuelto** | `<meta name="referrer" content="no-referrer">` |
| P1 | Contraseñas filtradas | **Abierto — acción del usuario** | Solo se activa en el panel de Auth |
| P2 | Cabeceras HTTP, `frame-ancestors`, HSTS | **Aceptado (limitación de GitHub Pages)** | Control compensatorio: CSP por `<meta>` (`base-uri 'none'`, `form-action 'self'`, `object-src 'none'`); HTTPS lo impone GitHub Pages |
| G1 | Secretos en el historial | **Sin hallazgos** | `git log -G` sobre 250 commits |
| — | Rotación de claves | Ver `ROTACION.md` | Nada se filtró; se listan acciones preventivas |

**Riesgos residuales:** (1) las funciones edge endurecidas no están desplegadas: hasta entonces E1–E5 siguen abiertos en producción (severidad A/M); (2) P1; (3) `style-src 'unsafe-inline'` necesario para los estilos en línea; (4) la prueba del cliente con supabase-js real bajo CSP no se pudo ejecutar contra Supabase (la red del entorno no lo alcanza) — se verificó que la biblioteca no usa `eval`.
**Criterio de cierre:** no se cumple al 100 %: quedan E1–E5 (alto/medio) pendientes de despliegue y P1; todo lo demás está resuelto o mitigado con prueba.
