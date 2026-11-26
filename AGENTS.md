# Reglas permanentes de VIVE V1

**VIVE V1 — una sola verdad.** Menos es más. Siempre.

1. **Una sola rama permanente: `main`.** Todo se integra y se publica desde `main`. Prohibido mantener ramas, versiones o entornos paralelos; una rama de trabajo se fusiona y se borra el mismo día.
2. **Una sola versión oficial: VIVE V1.** Un solo repositorio, **un solo despliegue (GitHub Pages)** y **un solo proyecto Supabase (plan Free)**. Prohibido Netlify/Vercel/Firebase u otra publicación, y cualquier servicio de pago.
3. **Un solo motor de sincronización:** la RPC `finance_apply_changes` + `v405Commit` + `supabase-rpc-guard.js`. **Cero reintentos infinitos** (todo reintento tiene tope y retroceso) y **cero versiones obsoletas autorizadas para escribir** (`app_policy.min_client_version`).
4. **Datos financieros intocables:** nunca borrar ni reescribir datos del usuario; todo cambio de base de datos lleva rollback y se prueba antes de aplicarse; ninguna operación sin aprobación expresa del titular modifica producción.
5. **Documentación mínima:** solo `README.md` y `AGENTS.md`. Prohibido crear informes, auditorías o historiales en el repositorio (la historia de Git es el historial).
6. **Limpieza obligatoria después de cada implementación:** sin código muerto, archivos duplicados, dependencias sin uso, workflows redundantes, cachés ni Service Workers; subir el `?v=` de lo cambiado.
7. **Prohibido introducir complejidad sin justificación** (una línea de motivo en el commit). Sin funcionalidades nuevas durante estabilización.
8. **Verificación real:** pruebas con Playwright en PC y móvil; no declarar nada «hecho» sin evidencia; informar con honestidad lo verificado y lo no verificado.
9. **Privacidad:** los datos financieros nunca salen de Supabase ni se envían a terceros; las pruebas usan datos simulados.
10. **Commits** terminan con los *trailers* de coautoría y sesión definidos por la herramienta que los crea.
