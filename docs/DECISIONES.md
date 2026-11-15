# Decisiones

| Fecha | Tema | Opciones | Elección | Motivo |
|---|---|---|---|---|
| 2026-11-15 | Respaldo previo | Etiqueta; rama | Rama `respaldo-antes-de-auditoria` | El entorno no permite subir etiquetas; la rama apunta al mismo punto y se restaura con un solo comando |
| 2026-11-15 | Fusión a la principal | Mantener ramas aparte; fusionar | Se fusionaron lógica, registro universal, seguridad y documentación | Petición expresa de trabajar sobre la principal |
| 2026-11-15 | Interfaz de la auditoría general | Ejecutar; omitir | Omitida | Petición expresa de no trabajarla |
| 2026-11-15 | Despliegue de funciones de borde endurecidas | Desplegar ahora; dejar en el repositorio | Dejadas en el repositorio | La ingesta de Apple Pay exigiría un secreto que los atajos actuales aún no envían; desplegar sin coordinarlo la dejaría sin funcionar |
| 2026-11-15 | Migración de vigencias a producción | Aplicar ya; solo repositorio | Solo repositorio | Ya probada en una base local; no se aplicó a Supabase sin un entorno de prueba propio |
| 2026-11-15 | Borrado de movimientos | Anulación con reversión; conservar papelera y auditar | Papelera existente más registro de auditoría con el valor anterior | Anular exigiría cambiar todos los cálculos; el registro de auditoría conserva el contenido |
| 2026-11-15 | Cierre por inactividad | 15, 30 o 60 minutos | 30 minutos | Equilibrio entre seguridad y uso normal; no cierra con cambios sin sincronizar |
| 2026-11-15 | Reintentos de red | Todas las llamadas; solo lecturas | Solo lecturas (3 reintentos con espera creciente) | Una escritura repetida podría duplicar una operación |
| 2026-11-15 | Fondo de las ventanas de registro | Con desenfoque; sin desenfoque | Atenuado sin desenfoque | Pedido de quitar el efecto de atrás |
