# 01 · Propósito y objetivo

## Qué es
Aplicación web progresiva (PWA) de finanzas personales en español para República Dominicana: pesos (DOP) y dólares (USD) en un mismo lugar. Título: «vive el hoy · Finanzas 360» (`manifest.webmanifest`, `index.html:5-18`).

## Problema que resuelve
Consolidar en una sola vista: cuentas y efectivo, tarjetas de crédito (con cortes y fechas de pago), préstamos, certificados, suscripciones y servicios, deudas entre personas, presupuesto, beneficios/cashback y compras de Apple Pay, calculando el efecto de cada operación sobre saldos y deuda (`app.js:5533` `saveTx`, `app.js:10005` `monthlyTotals`).

## Usuarios
- **Usuario único por cuenta** autenticado con correo y contraseña (`app.js:7361`). No hay roles, equipos ni uso compartido de datos `[no existe en el código]`.
- Uso móvil (iPhone, instalada como PWA) y escritorio (`app.js:4463` `isMobileViewport`: umbral 790 px).

## Objetivos observables en el código
1. Registrar ingresos, egresos, transferencias, pagos de tarjeta/préstamo/servicio (`app.js:4422` `FLOW_CATALOG`).
2. Mostrar capacidad de endeudamiento y presión de caja antes y después de cada gasto (`app.js:10272` `v80Assessment`, `app.js:10486` `v89DebtCapacity`).
3. Sincronizar entre dispositivos con Supabase y no perder datos ante fallos de red (`app.js:7445` `f33Flush`, `app.js:7670` `v405Commit`).
4. Capturar compras de Apple Pay desde el iPhone mediante Atajos (`app.js:12852` `v212ImportEvent`).
5. Exportar información (CSV de movimientos `app.js:6074`, Excel anual `advancedCsv` (`app.js:3912`)).

## No-objetivos (hoy)
- No conecta con bancos ni agrega transacciones automáticamente (la única entrada automática es Apple Pay vía Atajos).
- No envía notificaciones push (las alertas son internas) — `README.md` raíz.
- No es contabilidad fiscal oficial: los estados de tarjeta son registros internos (`app.js:1128` aviso «Los importes son registros internos»).
- No hay modo multiusuario/familiar, ni API pública, ni app nativa.
