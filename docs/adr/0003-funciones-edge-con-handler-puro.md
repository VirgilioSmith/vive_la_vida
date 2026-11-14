# ADR 0003 · Funciones edge con `handler.mjs` testeable
**Contexto:** el código de las funciones solo existía en Supabase y no podía probarse.
**Decisión:** lógica en `handler.mjs` con dependencias inyectadas; `index.ts` solo cablea Deno. Límite de tasa, errores genéricos y JSON garantizado.
**Consecuencias:** 32 pruebas con Node (`supabase/tests`). Las funciones viven ahora en el repositorio.
