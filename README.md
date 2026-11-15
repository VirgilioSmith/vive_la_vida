# vive el hoy · Finanzas 360

PWA de finanzas personales **en español** (pesos dominicanos y dólares). Es un sitio estático que se publica en GitHub Pages; los datos viven en el dispositivo y se respaldan y sincronizan con Supabase.

La idea: ver de un vistazo **cuánto tienes, cuánto debes y qué viene**, y registrar gastos, ingresos, pagos de tarjeta y préstamos sin hojas de cálculo.

---

## Qué hace

| Área | Qué encuentras |
|---|---|
| **Inicio** | KPI principal (estilos Original, Simple o Matriz Jobs), widgets personalizables: patrimonio, capacidad de endeudamiento, compromisos, salario anticipado, radar de vencimientos, huella de gastos, calendario de presión y más. |
| **Matriz Jobs** | Cuatro miradas del dinero: Entender, Actuar, Anticipar y Decidir. Desde «Anticipar» eliges qué tarjeta, préstamo, suscripción o persona pagar. |
| **Wallet y tarjetas** | Tarjetas de crédito con corte, pago, límite con vigencia, avance de efectivo, utilización y estado de cuenta. |
| **Bancos y cuentas** | Instituciones con su logo, cuentas, efectivo, certificados y saldos en RD$ y US$. |
| **Préstamos** | Cuotas, intereses por vigencia, quincenal o mensual, simulador de ahorro. |
| **Ingresos** | Fuentes recurrentes (nómina, joseo), cobro anticipado, composición y evolución. |
| **Egresos y presupuestos** | Categorías, presupuesto del mes, ejecución y tendencia. |
| **Suscripciones** | Pagos recurrentes con iconos, próximo cobro y registro de pago. |
| **Entre personas** | Dinero prestado y por devolver. |
| **Apple Pay** | Compras de Wallet por clasificar. |
| **Registrar** | Un solo flujo universal (web y móvil) con selector de cuentas y tarjetas, formato DOP y vista previa del impacto. |
| **Score** *(experimental, solo escritorio)* | VIVE SCORE CRÉDITO: puntuación crediticia propia, explicada, con cuestionario de antecedentes, simulador y capacidad de endeudamiento. Ver [`src/vive-score/README.md`](src/vive-score/README.md). |
| **Vive** | Generador de frases y mensajes simples («presente», «otro instante», copiar). |

Todo se adapta al **color de acento** que elijas y a los temas claro y oscuro.

---

## Estructura del repositorio

```text
.
├── index.html                  Cascarón de la PWA (meta, CSP, carga de scripts y estilos)
├── manifest.webmanifest        Instalación como app (iconos, colores)
├── src/                        Código de la aplicación
│   ├── app.js                  Lógica y vistas (se carga en el navegador)
│   ├── styles.css              Todos los estilos (cascada por versiones)
│   ├── early.js                Montaje temprano y síncrono de las vistas
│   ├── lib/finanzas/reglas.js  Reglas de cálculo puras, sin DOM (también usadas por las pruebas)
│   └── vive-score/             Módulo experimental VIVE SCORE CRÉDITO (aislado y reversible)
├── assets/icons/               Iconos de la PWA y favicon
├── vendor/                     Biblioteca de Supabase fijada y su huella SHA-384
├── supabase/                   Backend: migraciones, funciones edge, pruebas y reversiones
├── tests/                      Pruebas automáticas (Playwright, Node)
│   ├── smoke.js · csp.js · xss.js
│   ├── harness.js · mock.js    Arnés con Supabase simulado
│   └── logica/                 Reglas, paridad con la app, recorridos y casos de negocio
└── docs/                       Documentación técnica, decisiones, seguridad y lógica financiera
```

---

## Cómo se ejecuta en local

No hay paso de compilación. Cualquier servidor estático sirve:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. La conexión a Supabase es opcional para explorar la interfaz.

## Pruebas

Requieren Node y Playwright (Chromium).

```bash
node tests/smoke.js        # recorrido general sin errores de consola
node tests/csp.js          # sin violaciones de la política de seguridad
node tests/xss.js          # sin inyección de contenido
node tests/logica/run.js   # reglas, paridad con la app y recorridos
```

El detalle de cada suite está en [`docs/11-pruebas.md`](docs/11-pruebas.md).

## Publicar (GitHub Pages)

Rama `main`, carpeta raíz. Tras cambiar `src/styles.css` o `src/app.js`, **sube el número `?v=`** del archivo correspondiente en `index.html` para romper la caché del navegador y de la PWA instalada.

---

## Datos y Supabase

- La clave del cliente es **publicable**: la seguridad descansa en RLS sobre las tablas `finanzas_estado`, `finance_revision`, `apple_pay_events` y `apple_pay_links`.
- Las escrituras pasan por una función RPC con reintento y espera creciente; la sincronización usa canales realtime.
- La biblioteca `@supabase/supabase-js@2.119.0` está **fijada y alojada en `vendor/`** (no se carga de un CDN) para cumplir la CSP.
- Las funciones edge (`apple-pay-ingest`, `apple-pay-link`, `apple-pay-shortcuts`) están en `supabase/functions/`; su despliegue es manual.
- La app **no envía notificaciones push**; las alertas son internas.

Más en [`docs/SUPABASE.md`](docs/SUPABASE.md), [`docs/05-modelo-de-datos.md`](docs/05-modelo-de-datos.md) y [`docs/security/`](docs/security/).

## Lógica financiera

Los cálculos importantes (vigencias de límites y tasas, antigüedad, cortes de tarjeta, capacidad de endeudamiento, auditoría de cambios) están como **reglas puras** en `src/lib/finanzas/reglas.js` y se comprueban contra la app real. Criterios y casos: [`docs/logica/`](docs/logica/).

---

## Documentación

| Quiero… | Leer |
|---|---|
| Entender el propósito y el alcance | [`docs/01`](docs/01-proposito-y-objetivo.md) · [`docs/02`](docs/02-alcance.md) |
| Ver la arquitectura y los flujos | [`docs/03`](docs/03-arquitectura.md) · [`docs/08`](docs/08-flujos.md) |
| Conocer cada módulo | [`docs/04`](docs/04-modulos.md) |
| Revisar datos, API y seguridad | [`docs/05`](docs/05-modelo-de-datos.md) · [`docs/06`](docs/06-api-y-funciones.md) · [`docs/07`](docs/07-seguridad.md) |
| Operar, probar y desplegar | [`docs/09`](docs/09-metodologia-y-herramientas.md) · [`docs/10`](docs/10-operacion.md) · [`docs/11`](docs/11-pruebas.md) |
| Ver decisiones tomadas | [`docs/DECISIONES.md`](docs/DECISIONES.md) · [`docs/adr/`](docs/adr/) |
| Seguir el historial | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) · [`docs/AVANCE.md`](docs/AVANCE.md) |

Índice completo en [`docs/README.md`](docs/README.md).

## Notas de diseño

- `src/styles.css` es una cascada larga por versiones (`V…`); los cambios nuevos se añaden al final con selectores más específicos y `!important` cuando hace falta.
- Los widgets de Inicio se definen en `V105_WIDGETS` (`src/app.js`) y su orden y visibilidad se guardan en los ajustes del usuario.
- Para nombrar o mover archivos, mantén `index.html`, `manifest.webmanifest` y `tests/` apuntando a las rutas de `src/` y `assets/`.
