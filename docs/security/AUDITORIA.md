# Auditoría de seguridad — Fase 0 (14-nov-2026)

Alcance: frontend (`index.html`, `src/app.js`, `src/styles.css`), configuración, funciones edge (`apple-pay-link`, `apple-pay-shortcuts`, `apple-pay-ingest`, leídas del proyecto), esquema/RLS/privilegios de Postgres (consultas al catálogo), dependencias e historial de git (250 commits). Valores de claves y datos: `<REDACTADO>`.
Severidades: C crítica · A alta · M media · B baja.

| ID | Sev. | Hallazgo | Evidencia | Riesgo | Corrección |
|---|---|---|---|---|---|
| S1 | **A** | El rol `anon` tenía `INSERT/UPDATE/DELETE/TRUNCATE` sobre `finance_items`, `finance_values`, `finance_revision` | `information_schema.role_table_grants` | Sin RLS efectiva para `TRUNCATE`; superficie innecesaria si se añade una política por error | Revocar todo a `anon` |
| S2 | **A** | `authenticated` podía escribir directo en tablas financieras (incl. `TRUNCATE`, `TRIGGER`), saltándose la validación de `finance_apply_changes` | Prueba «ANTES: delete directo permitido» | Un usuario (o un XSS con su sesión) podría corromper o vaciar sus propios datos sin control de revisión | Solo `SELECT`; escritura únicamente vía RPC `SECURITY DEFINER` con `auth.uid()` |
| S3 | M | `finance_write_item(p_user …)` ejecutable por usuarios autenticados con `p_user` arbitrario | `pg_proc` + `has_function_privilege` | Escritura sobre otro usuario si RLS falla | `SECURITY DEFINER` interno y `EXECUTE` revocado |
| E1 | **A** | `apple-pay-ingest` sin límite de tasa; token falso sin freno | `index.ts` v12 | Fuerza bruta de token (256 bits: inviable) pero inundación de bandeja y consumo de recursos | Límite por vínculo (30/min) y por origen (20 fallos/min) |
| E2 | M | Respuestas distintas `invalid_token` vs `link_revoked` | `apple-pay-ingest` v12 | Permite saber si un token tuvo vínculo | Respuesta única `401 unauthorized` |
| E3 | M | CORS `*` en las tres funciones | cabeceras `HEADERS` | Uso desde cualquier sitio web | Sin CORS en ingest/shortcuts (clientes nativos); lista de origen en `apple-pay-link` |
| E4 | M | Mensajes de error con detalle interno (`delete_migration_required`, textos de RPC) | `apple-pay-link` v8 | Fuga de información | Errores genéricos; detalle solo en logs sin valores |
| E5 | M | Sin `try/catch` global en las funciones | código v8/v12/v4 | Respuesta no JSON ante excepción | Captura global → 500 JSON genérico |
| F1 | **A** | Sin CSP | `index.html` | XSS ejecutable con scripts remotos | CSP por `<meta>` (`script-src 'self'`) |
| F2 | M | `supabase-js` desde CDN sin SRI | `index.html:35` | Compromiso de la CDN = ejecución de código | Biblioteca local `vendor/supabase.js` (hash SHA-384 registrado), versión fija |
| F3 | M | Scripts en línea impedían CSP estricta | `index.html:19-31` | — | Movidos a `src/early.js` |
| F4 | M | ~257 usos de `innerHTML` con datos de usuario | `src/app.js` | XSS almacenado | `sanitize` ya cubre los campos probados; prueba automática de 4 cargas × 22 pantallas × 7 modales (sin hallazgos) |
| F5 | B | Sin `Referrer-Policy` | `index.html` | Fuga de URL | `<meta name="referrer" content="no-referrer">` |
| P1 | M | Protección contra contraseñas filtradas desactivada | Asesor de seguridad de Supabase | Contraseñas comprometidas aceptadas | **Acción del usuario** (panel de Auth) |
| P2 | B | `X-Content-Type-Options`, `X-Frame-Options`, HSTS no configurables en GitHub Pages | Plataforma | Clickjacking | Limitación documentada; mitigación: CSP `form-action/base-uri`, `frame-ancestors` no aplicable por `<meta>` |
| G1 | — | Secretos en el historial de git | `git log -G` (service_role, sb_secret, JWT, `vhap_`, claves privadas, contraseñas) | **Ningún hallazgo** | — |
| D1 | — | Dependencias | `npm audit` de `@supabase/supabase-js@2.119.0`: 0 vulnerabilidades | Sin hallazgos | — |
| R1 | — | RLS en todas las tablas | `pg_class.relrowsecurity` | Activo en 6/6 tablas | — |
