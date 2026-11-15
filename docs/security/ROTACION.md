# Qué claves rotar

El historial de git **no contiene** claves secretas (búsqueda de `service_role`, `sb_secret`, JWT, claves privadas, contraseñas y tokens `vhap_`), por lo que **no es necesario reescribir el historial**.

| Elemento | ¿Rotar? | Motivo | Cómo |
|---|---|---|---|
| Clave publicable de Supabase (en `src/app.js`) | No | Es pública por diseño; protegida por RLS | — |
| Clave de servicio (`service_role` / secret key) | Solo si alguna vez la pegaste en un chat, captura o archivo fuera de Supabase | Nunca apareció en el repositorio | Supabase → Settings → API Keys → regenerar y redeployar funciones |
| Tokens `vhap_…` de Apple Pay | Si compartiste una captura de pantalla o un Atajo exportado | Cada token da acceso de escritura de compras a su tarjeta | En la app: Ajustes → Apple Pay → eliminar vínculo y crear uno nuevo; actualizar el Atajo |
| Contraseña de tu cuenta | Recomendado una vez | Para activar la protección de contraseñas filtradas | Cambiarla tras activar «Leaked password protection» |

Pasos que solo puedes hacer tú: (1) activar *Leaked password protection*; (2) desplegar las funciones endurecidas (`docs/security/DESPLIEGUE.md`); (3) rotar lo marcado arriba si aplica.
