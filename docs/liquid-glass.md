# Vive Liquid Glass Engine (v1)

Capa óptica sobre el Glass Engine (`docs/glass-engine.md`). Archivos: `src/liquid-glass.css`, `src/liquid-glass.js`, `src/liquid-art.js`, `tests/liquid-glass.js`.

## 1 · Auditoría previa: por qué no se conseguía el efecto

Medido en la app real (Chromium, Wallet/Bancos/Inicio, PC y móvil):

| Hallazgo | Medida |
|---|---|
| Elementos con `backdrop-filter` activo por vista | 3–6 (el CSS declara cientos, pero casi todas las tarjetas lo anulan) |
| Filtros SVG en el documento | **0** (no existía refracción de ningún tipo) |
| Fondo de la página | casi plano (`#f6f4fa` + motas diminutas): el desenfoque no tiene nada que desenfocar |
| Material de las tarjetas | relleno degradado blanco + un `inset 1px`; ni rim, ni espesor, ni reflejo que reaccione |
| Tema Black en Buscar | tarjetas pastel claras y títulos azul oscuro (`-webkit-text-fill-color:#17233f!important`) ilegibles sobre negro |
| Ilustraciones de Buscar | 2,5D plano de colores sólidos, sin relación con el material |

Causa raíz: el «cristal» era un **relleno blanco translúcido sobre un fondo liso**; sin contenido detrás ni borde óptico, no hay nada que se lea como vidrio.

## 2 · Arquitectura

Una sola lista de superficies (en `liquid-glass.js`) → el JS marca con `data-vlg` los elementos cuyo `::before` y `::after` están libres → el CSS solo conoce `[data-vlg]`.

Capas (de abajo arriba, sin eventos y bajo el contenido):

1. **Cuerpo**: lo pone el Glass Engine (relleno + `backdrop-filter`).
2. **`::after` volumen**: brillo de curvatura, mancha especular que sigue a la luz, absorción inferior (espesor), tinte cromático del acento y luz interior del borde.
3. **`::before` rim**: borde de 1 px con degradado cónico (esquinas iluminadas, lados que se apagan) recortado con máscara.
4. **Refracción** (solo Chromium): `backdrop-filter:url(#vlg-refract)`; un mapa de desplazamiento (`feImage` + `feDisplacementMap`) curva el fondo en el borde como una lente.
5. **Atmósfera** `#vlg-aura`: tres luces estáticas (acento, azul frío, ámbar) para que el cristal tenga algo que absorber.

Modos: `refract press` (dock, FAB, controles), `panel` (tarjetas), `sheet`, `aft` (el componente ya usa `::before`: el rim se emula con luz interior direccional), `bare` (otra regla fuerza `content:none`: solo refracción/pulsación). Si `::after` está ocupado, el componente se respeta y no se toca.

### Tokens (`:root`, sobrescritos en Black)
`--vlg-rim`, `--vlg-rim-min`, `--vlg-spec`, `--vlg-sheen`, `--vlg-depth`, `--vlg-absorb`, `--vlg-inner`, `--vlg-shade`, `--vlg-bf`, `--vlg-aura-a/b/c`, `--vlg-press`, `--vlg-lx/--vlg-ly` (posición de la luz).

## 3 · Dinámica y rendimiento

* La luz solo cambia con puntero/pulsación (un frame por evento, dos variables CSS en **un** elemento) y vuelve a su base al salir.
* Cero animaciones infinitas del motor (el símbolo de Vive Intelligence conserva la suya, pedida expresamente).
* Presupuesto: ≤ 14 elementos con `backdrop-filter` por vista (comprobado en la prueba).
* Sin Canvas ni WebGL: no aportan nada que el CSS/SVG no logre aquí, y costarían batería. Evaluados y descartados.
* Sin consultas a Supabase (comprobado: 0 peticiones a `supabase.co` durante la prueba).

## 4 · Capacidades y degradación

| Entorno | Resultado |
|---|---|
| Chromium con `backdrop-filter` | Todo: capas + refracción |
| Safari / Firefox | Capas completas, **sin** refracción (`backdrop-filter:url()` no es fiable fuera de Chromium) |
| Sin `backdrop-filter` | Fondo más sólido (`@supports not`) |
| `prefers-reduced-transparency` / `.vg-reduce-transparency` | Sin refracción, sin desenfoque extra, sin atmósfera |
| `prefers-reduced-motion` / `.vg-reduce-motion` | Luz estática, sin transiciones |
| `prefers-contrast: more` | Rim al máximo, sin atmósfera |
| Equipos de poca potencia (`hardwareConcurrency ≤ 3`, `deviceMemory ≤ 2`, ahorro de datos) | Sin refracción ni luz dinámica |

## 5 · Ilustraciones de Buscar (`liquid-art.js`)

Seis SVG estáticos (Mi dinero, Tarjetas, Pagos, Servicios, Movimientos, Analítica) con el mismo lenguaje: cuerpo translúcido con absorción cromática, rim, brillo de curvatura, especular, espesor y refracción SVG del contenido que queda tras el cristal. Conservan su color de identidad; en Black se ven como objetos de cristal sobre negro.

## 6 · Estado de verificación (honesto)

| Control | Estado |
|---|---|
| Capas, refracción real (píxeles cambian), luz, accesibilidad, ilustraciones, Black en Buscar (`tests/liquid-glass.js`, 50 comprobaciones) | **Verificado en Chromium** |
| Rama «sin refracción» | Verificada por lógica de detección (User-Agent de Safari no es Chromium); **no** en el motor WebKit |
| **Safari iOS / WebKit real** | **NO verificado**: la descarga de WebKit está bloqueada en este entorno. Pendiente de prueba en un iPhone o con Playwright-WebKit |
| Comparación con la referencia (imagen de ChatGPT) | Cualitativa: rim luminoso direccional, profundidad, negros auténticos. No es una comparación píxel a píxel (la referencia es un render conceptual, no una captura de la app) |
| Artefactos previos detectados (no causados por el motor) | En Black PC (Wallet) hay rectángulos oscuros tras el grupo de acciones y tras el título de «Beneficios y retorno»; esquinas cuadradas en algunos paneles. Se reproducen con el motor desactivado. Pendientes de corregir |

## 7 · Pendientes conocidos (registrados, sin resolver)

| Pendiente | Detalle |
|---|---|
| Bancos PC por debajo de ~1180 px | Las 4 tarjetas KPI pasan a 2×2 y los paneles inferiores se montan entre sí (alturas fijas). Decisión del usuario: queda pendiente. |
| Rectángulos oscuros en Black PC (Wallet) | Detrás del grupo de acciones de la barra superior y del título «Beneficios y retorno»; se reproducen con el motor desactivado. |
| Safari iOS / WebKit real | No verificado (descarga de WebKit bloqueada en este entorno). |
| `dynamic-appearance` | Falla igual en el commit anterior a esta sesión (`.vBanks-mobile-selector` no aparece): preexistente. |
