# 08 · Flujos principales

## Registro de una compra
```mermaid
sequenceDiagram
  actor U as Usuario
  participant UI as Formulario (guidedTransactionForm)
  participant L as Lógica (saveTx / persist)
  participant S as Sync (f33Flush)
  participant DB as Supabase RPC finance_apply_changes
  U->>UI: monto, categoría, cuenta/tarjeta, fecha
  UI->>L: submit #transactionForm → fromForm → saveTx (app.js:5531-5533)
  L->>L: valida, actualiza db, recalcula saldos
  L-->>U: confirmación (v156TransactionFeedback)
  L->>S: persist() marca sucio
  S->>DB: cambios + revisión esperada (app.js:7670)
  alt revisión coincide
    DB-->>S: nueva revisión
  else conflicto 40001
    DB-->>S: error
    S->>S: v405Reconcile → fusión de 3 vías o conflicto protegido
  end
```

## Sincronización de Apple Pay
```mermaid
sequenceDiagram
  participant W as Wallet / Atajo iOS
  participant A as apple-pay-shortcuts
  participant I as apple-pay-ingest
  participant P as Postgres
  participant R as Realtime
  participant C as App (v212Sync)
  W->>A: POST x-vive-token + importe/comercio/event_id
  A->>A: normaliza importe y moneda
  A->>I: reenvía (timeout 14 s)
  I->>P: token_hash → vínculo activo
  I->>P: ¿existe (link_id,event_id)? idempotencia
  I->>P: INSERT apple_pay_events status=pending
  P-->>R: INSERT
  R-->>C: evento (app.js:7850)
  C->>P: SELECT pending (app.js:12876)
  C->>C: v212ImportEvent → movimiento card_charge "Apple Pay"
  C->>P: marca status importado (v212Mark, app.js:12661)
```
Respaldo: sondeo cada 30 min con Realtime conectado, 3 min sin él (V1044).

## Cálculo de beneficios
```mermaid
flowchart LR
  T[Movimientos card_charge/card_reward] --> B[benefitBreakdown app.js:1390]
  R[card.benefitRules] --> B
  B --> K[v389BenefitsKPIs app.js:11480]
  B --> W[v371CardReturnWidget app.js:1044]
  K --> P[Pantalla Beneficios]
```
Los beneficios son **registros manuales** («Un registro manual por tarjeta», `app.js:1605`): no hay cálculo automático desde el banco.

## Cierre de periodo
No existe un proceso de «cierre» ejecutado por servidor. El periodo es el mes seleccionado (`ui.month`) y los cortes de tarjeta se derivan por fecha: `v102CardStatusRaw` (`app.js:342`) calcula facturado, no facturado y vencido a partir de `cutDay`/`dueDay`; `monthlyTotals` (`app.js:10005`) agrega por mes; `v169UpdateOnDateChange` (`app.js:331`) refresca al cambiar la fecha; `v40ProcessDue` (`app.js:8097`) genera pagos automáticos vencidos. `[POR CONFIRMAR]` si algún paso persiste «cierres» además de `db.statements` (`app.js:1725`).
