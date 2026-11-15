# Catálogo y estado de vive el hoy · Finanzas 360

Fecha: 14 nov 2026 · Versión de código: V1014 · Calificación global: **73 / 100** (antes 64 → 70)

## 1. Cifras del código
| Dato | Valor |
|---|---|
| `src/app.js` | 2,4 MB · ~20.800 líneas · 244 acciones (`case`) · 24 pantallas registradas |
| `src/styles.css` | 3,9 MB · ~56.000 líneas · 39.400 `!important` · ~12.900 colores hexadecimales |
| Capas de versión (`V###`) acumuladas | más de 1.000; cada una sobrescribe a la anterior |
| Diálogos nativos del navegador (`confirm`) | 25 llamadas → diálogo propio (V1011), con respaldo nativo si no se identifica la acción |

## 2. Catálogo de pantallas
**Móvil (barra inferior):** Inicio · Wallet · Bancos (Instituciones, Cuentas, Tarjetas, Préstamos, Certificados) · Explorar (módulos) · Buscar · botón Registrar (+) · botón historial.
**Web (rail de iconos):** Inicio · Bancos · Operaciones (Movimientos, Ingresos, Egresos, Presupuestos, Categorías) · Visión · Calendario · Ajustes.
**Compartidas:** Movimiento (detalle), Notificaciones, Pago de servicios, Suscripciones, Entre personas, Beneficios, Patrimonio, Proyección, Presión financiera, Avanzado, Ajustes.

## 3. Catálogo de componentes (lenguaje visual vigente)
| Componente | Estilo de referencia | Estado de coherencia |
|---|---|---|
| Botón primario | degradado del acento (`--v424-accent-strong`) | Coherente tras V1005 |
| Flecha de navegación en tarjeta | círculo 36 px, tinte del acento | Coherente en Wallet (V1006); falta revisar Bancos/Inicio |
| Icono de institución | logo o iniciales con color del banco | Coherente en cuentas, préstamos, certificados, tarjetas |
| Icono de categoría | sistema único `v255TaxonomyIconName` | Coherente en registro y confirmación (V1004) |
| Cabecera de detalle | degradado del acento | Coherente en tarjeta y movimiento (V1008) |
| Detalle de movimiento | vista nueva «Movimiento» | Móvil (V1007) y web (V1012) unificados |
| Confirmaciones | diálogo propio (V1011) | Coherente |
| Colores de datos (gráficas) | paleta fija azul/verde/ámbar | Aceptable (son categóricos), pero la 1.ª serie podría ser el acento |

## 4. Hallazgos por severidad
**Alta**
1. 25 `confirm()` nativos (eliminar, restaurar, vaciar datos…). Rompen la narrativa visual y en iOS PWA se ven fuera de la app. *Plan:* un diálogo propio asíncrono y migrar los 25 sitios.
2. Detalle de movimiento en web sigue en el modal antiguo (la tabla usa `v6WalletTransactionDetail`). *Plan:* misma vista nueva a pantalla completa o panel lateral.
3. Seguridad de datos depende de RLS de Supabase que no está en el repositorio; las funciones `apple-pay-*` tampoco.

**Media**
4. Textos azul grisáceo fijos (`#39547a`, `#607a9d`) en pestañas inactivas, píldoras y botones pequeños: con paleta guinda se ven «azulitos». *Plan:* variable de tinta neutra derivada del acento.
5. Segunda serie de colores de gráficas no sigue el acento (barras de ranking de ingresos, dona).
6. Kicker de cabeceras ejecutivas con el acento sobre fondo de acento (ilegible): corregido en V1009.
7. 39.400 `!important` y capas superpuestas: cada cambio exige subir especificidad. *Plan:* consolidar por componente en 4–5 archivos de diseño con variables.
8. Wallet solo existe en móvil (en web se redirige a Tarjetas).

**Baja**
9. El subtítulo «Pesos y dólares» puede cortarse en pantallas de 390 px.
10. `README` y `docs/AVANCE.md` requerían actualización (hecho).
11. Supabase-js fijado a 2.119.0 sin SRI (la red del entorno de pruebas no alcanzaba el CDN).

## 5. Calificación por dimensión (0–100)
| Dimensión | Nota | Por qué |
|---|---|---|
| Funcionalidad y datos | 78 | Registro, saldos, tarjetas, préstamos y sincronización funcionan; 0 errores de consola en 20 pantallas × 2 formatos |
| Coherencia visual (acento) | 66 | Tarjetas, wallet, registro y detalles ya siguen el acento; quedan azules fijos en neutrales y gráficas |
| Coherencia de flujos | 60 | Móvil unificado en movimiento/registro; web aún mezcla modal antiguo y vistas nuevas; confirmaciones nativas |
| Móvil | 72 | Buena jerarquía y barra inferior; detalles pendientes de pulido |
| Web | 58 | Rail de iconos y registro rápido nuevos; el resto aún es adaptación del móvil |
| Mantenibilidad del código | 55 | Ahora en 3 archivos y sin 155 funciones/5.500 reglas muertas, pero 39 mil `!important` y 1.000+ capas |
| Accesibilidad | 62 | `aria-label` presentes (518), foco gestionado en modales; sin auditoría de contraste completa |
| Seguridad / backend | 55 | Clave publicable correcta; RLS y edge functions no verificables desde el repo |
| Rendimiento | 60 | 6,3 MB de código sin minificar ni dividir; carga bien en caché pero el primer arranque es pesado |

**Global ponderado: 64 / 100.**

## 6. Hoja de ruta para llegar a 85
1. Diálogo de confirmación propio (alta).
2. Detalle de movimiento único en web (alta).
3. Neutrales derivados del acento y 1.ª serie de gráficas = acento (media).
4. Consolidar CSS por componente y minificar (media).
5. Documentar RLS y funciones edge en el repositorio (alta, depende de Supabase).

## 7. Actualización V1013 — nota 70/100
| Dimensión | Antes | Ahora | Qué lo mueve |
|---|---|---|---|
| Funcionalidad y datos | 78 | 80 | Pagar servicio directo al formulario (V1010) |
| Coherencia visual | 66 | 74 | Neutros y primera serie de gráficas derivados del acento; kicker legible |
| Coherencia de flujos | 60 | 76 | Confirmaciones propias; un solo detalle de movimiento en móvil y web |
| Móvil | 72 | 76 | |
| Web | 58 | 64 | Detalle de movimiento nuevo |
| Mantenibilidad | 55 | 55 | Sin cambios (siguen los `!important`) |
| Accesibilidad | 62 | 64 | Diálogo con foco atrapado, Esc y rol alertdialog |
| Seguridad / backend | 55 | 55 | Depende de Supabase |
| Rendimiento | 60 | 60 | |

**Por qué no es 100:** (a) el CSS tiene unos 39.000 `!important` y más de 1.000 capas; llevarlo a un sistema limpio exige reescribir el diseño pantalla por pantalla; (b) las reglas RLS y las funciones edge no están en el repositorio y no se pueden verificar desde aquí; (c) no hay pruebas automáticas ni auditoría de contraste completa; (d) el fondo y el rediseño web de las pantallas de análisis siguen pendientes.

## 8. Actualización V1014 — nota 73/100 (mejoras sutiles, sin tocar la lógica ni la estructura)
| Mejora | Efecto medido |
|---|---|
| El acento se oscurece solo lo mínimo para que el texto blanco sobre él cumpla 5:1; texto atenuado más legible | Fallos de contraste (axe-core, 18 pantallas × 2 formatos): 134 → 43 |
| `role="tablist"` sin pestañas y `<main>` anidado corregidos | Fallos críticos de estructura: 2 → 0 |
| `tests/` con arnés y prueba de humo (`node tests/smoke.js`) | Primer control automático en el repositorio |
| `docs/SUPABASE.md` con las tablas, columnas y políticas RLS esperadas | Backend documentado (sigue sin verificarse en tu proyecto) |

| Dimensión | V1013 | V1014 |
|---|---|---|
| Accesibilidad | 64 | 78 |
| Mantenibilidad (pruebas + documentación) | 55 | 60 |
| Seguridad / backend (documentado, no verificado) | 55 | 60 |
Las demás se mantienen. **Global: 73.**

Pendiente para seguir subiendo: 43 contrastes sueltos, 2 encabezados fuera de orden, `aside` dentro de `main`, consolidar el CSS, verificar RLS en Supabase.
