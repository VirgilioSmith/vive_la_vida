# Vive el hoy · Finanzas 360 — Versión 5

## Apple Pay · Categoría provisional y recordatorio
- Todo **nuevo** evento importado de Wallet se registra con categoría **Apple Pay** y subcategoría vacía.
- La categoría personalizada se crea automáticamente si no existía; el usuario puede modificarla desde Movimientos.
- Al finalizar la sincronización, aparece un aviso dentro de la app con botón **Cambiar categoría**, que abre el editor original sin duplicar registros.
- Si el navegador ya autorizó notificaciones, también aparece un aviso del sistema cuando la web está abierta y visible. No se solicita permiso automáticamente ni se envían Web Push en segundo plano.
- Al reabrir la app se recuerda una compra que siga sin categorizar.
- Se muestra el distintivo Apple Pay en el historial web y móvil, reutilizando la marca ya presente en otras vistas.
- No se alteran los importes, métodos de contabilización, vínculos de tarjetas, funciones Supabase ni el esquema de datos.

## Alcance
La notificación del sistema requiere permiso previamente concedido y la web abierta; recibir notificaciones **con la app cerrada** necesita una integración Web Push adicional en el servidor.

Recomendación: probar una compra de prueba real y verificar su categoría, su distintivo, el cambio manual de categoría y la sincronización.
