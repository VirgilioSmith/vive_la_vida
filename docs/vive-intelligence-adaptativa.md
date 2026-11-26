# VIVE Intelligence · evolución adaptativa (fases 1–3 y parte de 4–5)

Este documento diferencia con claridad **lo implementado y probado**, **lo experimental** y **lo planificado**.
La arquitectura de la fase anterior (`docs/vive-intelligence.md`) se conserva: reglas, franja contextual, hoja y aprendizaje básico siguen funcionando.

## 1 · Auditoría previa (resumen)
* Datos: `db` en memoria; guardado por `persist()` → RPC `finance_apply_changes` (diferencial). No hay metas, garaje ni bienestar guardados.
* Cálculos reutilizados: `monthlyTotals`, `cardStatus`, `upcoming`, `v89DebtCapacity`, `historicalPosition`, caché `v99Memo` con `v99Invalidate`.
* Sin Realtime nuevo, sin polling, sin tablas nuevas. Contrato de datos: el puente `window.__viveIntel` (solo lectura, salvo la memoria del propio motor).
* Riesgo principal: CPU de Supabase por escrituras repetidas → toda la inteligencia se calcula **en el dispositivo** y la memoria se guarda como máximo **una vez al día** (y al dar retroalimentación).

## 2 · Matriz de capacidades

| Motor | Estado | Método | Verificado con |
|---|---|---|---|
| Pattern (día de la semana, tras el cobro) | **Implementado y probado** | media por día + bootstrap (300), ventana de 72 h tras cobro | `intelligence-discovery.js` |
| Anomaly | **Implementado y probado** | z robusto (mediana/MAD) **y** Isolation Forest (consenso), contexto (feriado, fin de semana, cobro), clasificación (extraordinaria / aumento generalizado / posible duplicado) | 25 series estacionarias: FP ≤ 12 % |
| Drift (cambio estructural) | **Implementado y probado** | CUSUM bilateral; la línea base **no** se adapta a un empeoramiento hasta que el usuario lo confirme | 25 series estacionarias: FP ≤ 12 % |
| Blind spot | **Implementado y probado** | micropagos acumulados; disponibilidad real vs aparente | datos sintéticos |
| Correlation | **Implementado, en silencio** (≥ 3 evaluaciones) | Spearman + p por permutación (800) + Benjamini–Hochberg q=0,10; |ρ|≥0,45, ≥16 semanas | 25 series independientes: FP ≤ 12 % |
| Prediction | **Implementado y probado** | selección entre 3 modelos por backtest temporal rodante (solo si mejora ≥ 5 % al ingenuo); Monte Carlo de liquidez a 30 días (600 trayectorias, semilla fija) con escenarios conservador/central | determinismo y datos insuficientes |
| Evolution | **Implementado y probado** | ventanas equivalentes de 30 días (frecuencia, gasto, ingresos) | datos sintéticos |
| Sequence | **Experimental** (≥ 3 evaluaciones) | prueba binomial exacta contra la tasa base | datos sintéticos |
| Counterfactual | **Implementado** (como simulación dentro de Drift) | acumulado frente a la línea base | texto marcado «Simulación» |
| Simulation | **Implementado y probado** (bajo demanda) | bootstrap mensual, 600 corridas, conservador/central/favorable | monotonía y determinismo |
| Confidence | **Implementado** | puntuación 0–1 documentada (volumen, fuerza, estabilidad, calidad); **no es probabilidad** | `confidence()` |
| Priority | **Implementado** | relevancia 0–100 multidimensional con pesos que evolucionan por retroalimentación | efectos verificables |
| Memory / Learning | **Implementado y probado** | memoria derivada: patrones, excepciones, hipótesis, metas, preferencias, pesos, fechas excluidas; consultar/corregir/eliminar/exportar; < 8 KB | 120 evaluaciones |
| Reflection | **Implementado** (preguntas desde la evidencia) | plantillas por tipo, sin imperativos | prueba de lenguaje |
| Context | **Parcial** | feriados de fecha fija (RD), fines de semana, días de cobro | anomalías |
| Behavior avanzado, Life ⟷ finanzas, Garaje, Metas, Bienestar, Apple Pay (horarios) | **Planificado — NO operativo** | la app no guarda esos datos o no hay base para un modelo honesto | — |
| ML multivariable (clusters, concept drift formal), secuencias avanzadas | **Planificado** | se activarán cuando existan datos y validación | — |

## 3 · Flujo implementado
Datos → libro mayor normalizado (excluye transferencias, pagos de tarjeta, cuotas, ajustes: sin doble contabilización) → **características calculadas una vez** (series diarias/semanales, ventanas 24 h…365 d, cobros, rango personal) → 8 motores (aislados: si uno falla, los demás siguen) → hipótesis → validación estadística → confianza → ciclo de vida (observación → hipótesis → aprendizaje → patrón/descubrimiento…) → **silencio inteligente** (solo se comunica con evidencia suficiente y ≥ N evaluaciones en días distintos, salvo casos inmediatos) → priorización → retroalimentación → memoria.

## 4 · Retroalimentación (10 opciones, efectos verificables)
Esto es correcto (consolida patrón, +peso) · No es correcto (descarta, −peso) · Fue una excepción (excluye esas fechas de la línea base) · Fue intencional (registra la decisión) · Ya lo sabía (silencia 60 d) · No me interesa (silencia 45 d, −peso) · Quiero seguir observándolo (estado seguimiento) · Quiero mejorar (crea meta con línea base) · Me ayudó (+peso) · No volver a mostrar este tipo (desactiva el tipo). Correcciones, preferencias y confirmaciones viven en estructuras separadas.

## 5 · Experiencia
Sin nueva navegación. Dentro de la hoja existente: **Descubrimientos** con «¿Cómo llegamos a esta conclusión?» (qué, con qué datos, metodología, evidencia, incertidumbre, alternativas, escenario alternativo), pregunta de reflexión, y el **centro de conocimiento** «Lo que Vive sabe de ti» (madurez objetiva por días de historial —no un porcentaje—, fuentes autorizadas, patrones, hipótesis en observación, excepciones, metas, aprendizaje por categoría, simulador, diagnóstico técnico, exportar y borrar). El Centro Estratégico recibe como máximo 2 hallazgos seleccionados, con mensajes breves («Algo cambió», «Vas mejorando», «Algo se acerca»…), y sin felicitaciones si hay compromisos críticos.

## 6 · Almacenamiento y Supabase
* **No se creó ninguna tabla, función ni migración.** El conocimiento derivado se guarda en `db.settings.intelligenceMem` (< 8 KB, podado), con la persistencia existente (RLS ya vigente de la tabla actual).
* Escrituras: ≤ 1 pequeña por día + 1 por acción de retroalimentación. Lecturas a Supabase: 0.
* **Propuesta (no aplicada):** si el conocimiento superara ~8 KB o se necesitara entre dispositivos fuera de `settings`, una única tabla `intelligence_knowledge(user_id uuid primary key references auth.users, data jsonb not null, updated_at timestamptz default now())` con RLS `user_id = auth.uid()` para select/insert/update/delete y sin triggers. Hoy no se justifica.
* Entrenamiento: ninguno en PostgreSQL. Todo en el cliente, determinista (semillas fijas), presupuesto de cómputo configurable (`budgetMs`).

## 7 · Rendimiento medido
Primer cálculo completo (8 motores + características) con 300 días y ≈ 480 movimientos: ≈ 3–5 ms en el navegador de pruebas; 3 × 365 días (> 1.700 registros) < 400 ms. Montaje de la franja con caché ≈ 0,06 ms. 8 renders consecutivos: ≤ 1 escritura. Cero peticiones a Supabase.

## 8 · Seguridad y privacidad
Procesamiento local; ninguna información sale del dispositivo; sin proveedores de IA; bienestar/garaje/metas no se cruzan porque no existen datos; el usuario puede consultar, corregir, eliminar, exportar y desactivar el aprendizaje por categoría.

## 9 · Limitaciones y riesgos
* La inteligencia depende de la calidad del registro; con < 70 días la mayoría de los motores permanecen en silencio por diseño.
* «Evaluaciones en días distintos» cuentan los días en que se abre la app; un usuario que la abre poco tardará más en ver descubrimientos (se prefiere el silencio a un falso positivo).
* Isolation Forest y Monte Carlo son estocásticos con semilla fija: son reproducibles pero dependen de los datos disponibles.
* El Monte Carlo de liquidez no modela ingresos irregulares ni gastos con tarjeta no pagados aún; sus supuestos se muestran.
* No hay validación con datos reales de usuarios (solo sintéticos y los datos de prueba de la app): los umbrales deben recalibrarse con uso real.
* Registro de ejecución: en memoria durante la sesión (diagnóstico técnico), no persistente.
