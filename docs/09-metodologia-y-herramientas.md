# 09 · Metodología y herramientas

## Stack
| Pieza | Tecnología | Evidencia |
|---|---|---|
| Frontend | HTML + CSS + JavaScript sin framework ni compilación | `index.html:35-36` |
| Backend | Supabase (Postgres 17, Auth, Realtime, Edge Functions en Deno/TypeScript) | `docs/SUPABASE.md`; funciones leídas por API |
| Hospedaje | GitHub Pages (rama `main`, raíz) | `README.md` |
| Pruebas | Playwright + arnés propio | `tests/` |

## Convenciones
- Versionado interno por etiquetas `V###` en comentarios y nombres de función; la última, **V1044**. Los estilos se apilan por «capas de versión» con `!important` (`styles.css`).
- Caché: parámetro `?v=N` en `index.html:35-36` que se incrementa a mano.
- Commits en español con trailer de coautoría y URL de sesión.

## Ramas y flujo
Ramas de trabajo → Pull Request → merge a `main` (140 merges en 2 días). Sin protección de rama ni CI `[POR CONFIRMAR]` configuración en GitHub. Versionado semántico: **no existe** (sin tags).

## Despliegue
- Frontend: al fusionar en `main`, GitHub Pages publica (`[POR CONFIRMAR]` ajustes de Pages).
- Supabase: cambios aplicados por herramienta de migraciones/SQL del panel; **no hay carpeta `supabase/` ni CLI configurada en el repo** → los pasos con Supabase CLI (`supabase db push`, `supabase functions deploy`) serían la práctica recomendada, hoy `[POR CONFIRMAR]`.
