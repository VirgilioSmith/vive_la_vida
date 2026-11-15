# 07 · Seguridad (estado actual)

> Describe lo que existe hoy. Las correcciones se tratan en el trabajo `security/hardening-v183`.

## Modelo de amenazas (resumido)
| Activo | Amenaza | Control actual |
|---|---|---|
| Datos financieros del usuario | Lectura/escritura por otro usuario | RLS por `user_id` en todas las tablas (ver [05](05-modelo-de-datos.md)) |
| Cuenta del usuario | Credenciales débiles/robadas | Supabase Auth con contraseña (`app.js:7361`); protección de contraseñas filtradas **desactivada** (asesor de seguridad) |
| Endpoint de Apple Pay | Compras falsas, repetición, abuso | Token `vhap_` de 256 bits con hash en BD; idempotencia por `event_id`; sin límite de tasa |
| Interfaz | XSS por datos con HTML | Función `sanitize` (`app.js:131`) usada en plantillas; ~257 usos de `innerHTML` |
| Cadena de suministro | Biblioteca externa alterada | `supabase-js` fijado a 2.119.0 desde CDN, **sin SRI** (`index.html:35`) |

## Autenticación y autorización
- Cliente: `createClient(<URL REDACTADA>, <CLAVE PUBLICABLE REDACTADA>)` con `persistSession` y `autoRefreshToken` (`app.js:6849-6850`, `7883-7886`). La clave publicable es pública por diseño; la seguridad descansa en RLS.
- Sesión guardada por supabase-js en `localStorage` del navegador `[POR CONFIRMAR]` clave exacta.
- Escritura de datos: mediante RPC `finance_apply_changes` (invoker) **y** políticas ALL sobre las tablas `finance_*`: el usuario puede escribir directamente en sus propias filas.
- Apple Pay: la vinculación exige JWT de usuario y que la tarjeta exista en sus datos; la ingesta exige el token.

## RLS y privilegios
- RLS activo en las 6 tablas (consulta `pg_class`), políticas de «propietario» (`auth.uid() = user_id`).
- **Privilegios de tabla amplios:** el rol `anon` tiene `INSERT/UPDATE/DELETE/TRUNCATE/…` sobre `finance_items`, `finance_values`, `finance_revision`; `authenticated` también incluye `TRUNCATE/REFERENCES/TRIGGER`. Con RLS activo y sin políticas para `anon`, las filas no son accesibles por la API, pero el privilegio excesivo no es mínimo.
- `finance_write_item` es ejecutable por `authenticated` y recibe `p_user`; al ser *invoker*, RLS impide escribir como otro usuario.

## Secretos
| Elemento | Dónde | Estado |
|---|---|---|
| Clave publicable de Supabase | `app.js:6850` | Pública por diseño |
| Clave de servicio | Entorno de funciones edge (`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEYS`) | No aparece en el repo ni en su historial (búsqueda `git log -G`) |
| Token `vhap_…` | Se emite una vez; en BD solo su SHA-256 | Guardado en el Atajo del iPhone por el usuario |

## Riesgos abiertos
1. Sin cabeceras de seguridad ni CSP (GitHub Pages no permite configurarlas; solo `<meta>`), `index.html:1-38`.
2. Sin SRI en la biblioteca de CDN (`index.html:35`).
3. Sin límite de tasa en las funciones edge (`apple-pay-ingest`, `apple-pay-shortcuts`).
4. CORS `*` en las tres funciones.
5. Privilegios `anon` y `TRUNCATE` sobre tablas de datos (ver arriba).
6. Mensajes de error de funciones con detalle (`delete_migration_required`, `error` en 422).
7. `innerHTML` extensivo: la protección depende de que cada interpolación pase por `sanitize` `[POR CONFIRMAR]` cobertura completa.
8. Protección contra contraseñas filtradas desactivada; política de MFA `[POR CONFIRMAR]`.
9. Funciones edge sin control de versiones en el repositorio.
