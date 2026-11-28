# Reglas permanentes de VIVE V1

**VIVE V1 — una sola verdad.** Menos es más. Siempre.

1. **Una sola rama permanente: `main`.** GitHub debe tener **exactamente una rama: `main`**. Todo se integra y se publica desde `main`. Prohibido crear o conservar ramas de cualquier tipo (respaldo, desarrollo, experimentación, correcciones, versiones anteriores) y prohibido crear respaldos dentro del repositorio: la historia de Git en `main` es el único respaldo. Una rama de trabajo, si fuese imprescindible, se fusiona y se borra el mismo día. Al terminar cada tarea se verifica con `git ls-remote --heads origin` que solo queda `main`.
2. **Una sola versión oficial: VIVE V1.** Un solo repositorio, **un solo despliegue (GitHub Pages)** y **un solo proyecto Supabase (plan Free)**. Prohibido Netlify/Vercel/Firebase u otra publicación, y cualquier servicio de pago.
3. **Un solo motor de sincronización:** la RPC `finance_apply_changes` + `v405Commit` + `supabase-rpc-guard.js`. **Cero reintentos infinitos** (todo reintento tiene tope y retroceso) y **cero versiones obsoletas autorizadas para escribir** (`app_policy.min_client_version`).
4. **Datos financieros intocables:** nunca borrar ni reescribir datos del usuario; todo cambio de base de datos lleva rollback y se prueba antes de aplicarse; ninguna operación sin aprobación expresa del titular modifica producción.
5. **Documentación mínima:** solo `README.md` y `AGENTS.md`. Prohibido crear informes, auditorías o historiales en el repositorio (la historia de Git es el historial).
6. **Limpieza obligatoria después de cada implementación:** sin código muerto, archivos duplicados, dependencias sin uso, workflows redundantes, cachés ni Service Workers; subir el `?v=` de lo cambiado.
7. **Prohibido introducir complejidad sin justificación** (una línea de motivo en el commit). Sin funcionalidades nuevas durante estabilización.
8. **Verificación real en Chromium Y WebKit (motor de Safari/iPhone):** pruebas con Playwright en PC y móvil en **los dos motores**; un cambio no está «hecho» si solo se probó en Chromium. Mínimo antes de publicar: `node tests/arranque.js` y `ARRANQUE_BROWSER=webkit node tests/arranque.js` (ambos OK) y revisión visual en WebKit de lo cambiado. No declarar nada «hecho» sin evidencia; informar con honestidad lo verificado y lo no verificado (WebKit de escritorio no es idéntico a un iPhone real). Incidente 27-nov: un bucle que solo ocurría en Safari bloqueó VIVE en iPhone y las pruebas en Chromium no lo vieron.
9. **Privacidad:** los datos financieros nunca salen de Supabase ni se envían a terceros; las pruebas usan datos simulados.
10. **Commits** terminan con los *trailers* de coautoría y sesión definidos por la herramienta que los crea.

## VIVE Intelligence — Fortalecimiento integral del motor de inteligencia

**Marco estratégico permanente y obligatorio para toda intervención en VIVE Intelligence.** Conocimiento global. Análisis profundo. Inteligencia contextual. Comunicación relevante. Evolucionar en profundidad, no en cantidad de módulos. Conservar íntegramente la implementación original, sus capacidades, reglas, premisas, arquitectura y experiencia visual; no sustituirla ni simplificarla. Las siguientes dimensiones constituyen objetivos de evolución y criterios de aceptación, no una declaración de que ya estén implementadas.

### 01. Optimización financiera permanente
Analizar continuamente las alternativas disponibles: qué tarjeta conviene utilizar según consumo, beneficios, disponibilidad y fechas de corte; desde cuál cuenta pagar; qué deuda priorizar; beneficios desaprovechados; productos que pierden rentabilidad; y cómo optimizar liquidez sin comprometer obligaciones futuras. Maximizar el valor de los productos financieros existentes.

### 02. Inteligencia invisible
Detectar silenciosamente cambios progresivos de comportamiento, deterioro de liquidez, incrementos silenciosos del consumo, dependencia creciente del crédito, gastos inusuales, oportunidades desaprovechadas y acumulación de pequeñas decisiones desfavorables. No esperar a que exista un problema para identificarlo.

### 03. Inteligencia relacional
Comprender integralmente las relaciones entre Wallet, Bancos, Movimientos, Tarjetas, Préstamos, Suscripciones y Beneficios. Analizar cómo cada decisión afecta simultáneamente distintas dimensiones financieras, sus causas, consecuencias, dependencias, compensaciones y efectos secundarios. Conocimiento global; comunicación estrictamente contextual según página, subvista y entidad seleccionada.

### 04. Autoconciliación inteligente
Supervisar la integridad financiera: duplicidades, transferencias incompletas, inconsistencias entre saldos y movimientos, clasificaciones incorrectas, posibles registros omitidos y discrepancias entre productos financieros. Presentar correcciones justificadas para revisión; nunca modificar información financiera silenciosamente ni sin autorización.

### 05. Inteligencia temporal
Comprender ciclos de ingresos y consumo, fechas de corte y vencimiento, temporadas de presión económica, períodos de disponibilidad financiera, recurrencias y tendencias de corto, mediano y largo plazo. Determinar qué comunicar, cuándo y por qué ese momento es relevante.

### 06. Inteligencia causal
Investigar qué factores explican cada variación, qué decisiones contribuyeron al resultado y qué relaciones podrían existir entre acontecimientos financieros. Diferenciar hechos comprobados, correlaciones e hipótesis; no atribuir causalidad sin evidencia suficiente.

### 07. Inteligencia predictiva
Anticipar escenarios con el comportamiento histórico y compromisos conocidos. Proyectar liquidez, utilización crediticia, presión financiera, consumo recurrente y capacidad de cumplimiento. Presentar estimaciones realistas que reconozcan incertidumbre, disponibilidad y calidad de datos.

### 08. Inteligencia contrafactual
Evaluar qué habría ocurrido con una decisión diferente. Comparar alternativas y estimar su impacto en liquidez, intereses, beneficios, endeudamiento y disponibilidad. Transformar experiencias pasadas en aprendizaje; distinguir escenarios simulados de hechos reales.

### 09. Inteligencia prescriptiva
Producir recomendaciones accionables y fundamentadas. Cuando corresponda, explicar qué sucede, por qué importa, qué alternativa existe, qué acción conviene considerar, su impacto estimado y cuándo actuar. Evitar mensajes genéricos y recomendaciones sin fundamento.

### 10. Inteligencia adaptativa
Construir un modelo dinámico del comportamiento financiero individual, aprendiendo de patrones, recurrencias, decisiones, preferencias y cambios de comportamiento. No utilizar criterios universales rígidos cuando haya evidencia suficiente para referencias personalizadas.

### 11. Inteligencia comparativa
Comparar el comportamiento actual con referencias históricas relevantes, períodos equivalentes, estacionalidad, recurrencias y circunstancias particulares. Identificar mejoras, retrocesos, desviaciones y cambios estructurales. No confundir variaciones temporales con tendencias permanentes.

### 12. Inteligencia de riesgo y resiliencia
Evaluar la capacidad para responder ante acontecimientos inesperados; detectar concentración de recursos, exposición crediticia, presión de obligaciones, dependencia de ingresos y vulnerabilidad de liquidez. Reconocer fortalezas y oportunidades de mayor estabilidad.

### 13. Memoria analítica
Mantener conocimiento histórico de descubrimientos, recomendaciones, cambios y situaciones previamente identificadas. Reconocer persistencia, mejora, desaparición y recurrencia. Evitar repetir insights sin novedad, sin ocultar riesgos persistentes relevantes.

### 14. Inteligencia sobre sus propias conclusiones
Evaluar internamente evidencia, suficiencia de datos, coherencia matemática, relevancia contextual, confianza, impacto financiero, vigencia temporal y ausencia de contradicciones y duplicidades. Reconocer explícitamente la incertidumbre cuando falten datos; nunca inventar conclusiones.

### 15. Orquestación universal de inteligencia
Integrar todas las capacidades en el motor centralizado existente; evitar motores duplicados, reglas contradictorias, consultas innecesarias y funcionalidades aisladas. Priorizar por impacto, urgencia, relevancia, novedad, confianza y capacidad de acción. No imponer límites artificiales a la cantidad de insights relevantes.

### 16. Premisas obligatorias de implementación
- Preservar íntegramente las capacidades existentes y la experiencia visual original, incluido el scrolling vertical de múltiples insights. Delimitar contexto no significa reducir profundidad ni cantidad de información relevante.
- Aplicar inteligencia exclusivamente sobre funcionalidades y datos reales existentes de VIVE (finanzas y Frases según su contexto). No inventar datos, módulos, metas, vehículos ni otras funcionalidades inexistentes. No crear nuevas pestañas ni módulos.
- No sustituir profundidad analítica por indicadores repetidos o mensajes genéricos. No ejecutar modificaciones financieras sin autorización.
- Optimizar consultas, procesamiento, caché e invalidación de resultados; evitar saturar Supabase con procesos redundantes o listeners permanentes.
- Mantener consistencia en móvil y Web PC. Auditar la implementación integral, verificar preservación de las capacidades originales, validar en Chromium y WebKit conforme a las reglas permanentes y publicar cambios definitivos directamente en `main`.
- VIVE Intelligence comprende el presente, relaciona, anticipa y recomienda; VIVE Wrapped interpreta la evolución y la convierte en historias; Notificaciones comunica aquello que requiere atención oportuna. No duplicar motores ni confundir sus responsabilidades.

**Objetivo definitivo:** hacer VIVE Intelligence significativamente más inteligente dentro de las funcionalidades que ya existen, no construir más funcionalidades.
