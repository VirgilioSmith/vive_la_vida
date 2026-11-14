# 04 · Módulos y pantallas

Todas las pantallas se registran en el mapa `pages` (`app.js:3798`) y se dibujan con `render()` (`app.js:5728`) dentro de `#app`. Los datos salen del objeto `db`; no hay llamadas a la red por pantalla (la red la gestiona la capa de sincronización, [03](03-arquitectura.md)).

| Módulo | Responsabilidad | Entradas | Salidas | Dependencias | Datos / endpoints |
|---|---|---|---|---|---|
| **Resumen** (`overview`) | Posición financiera, compromisos, pagos próximos, presupuesto, gráficas | `db.accounts/cards/loans/recurring/transactions`, `ui.month` | Tarjetas KPI, widgets personalizables | `monthlyTotals` (`app.js:10005`), `v89DebtCapacity` (`10486`) | Solo `finance_*` vía sincronización |
| **Beneficios y cashback** (`benefits`) | Registro manual de beneficios por tarjeta; retorno | `card.benefitRules`, movimientos `card_reward` | KPIs y tabla por tarjeta | `benefitBreakdown` (`app.js:1390`), `v389BenefitsKPIs` (`11480`), `v371CardReturnWidget` (`1044`) | `finance_*` |
| **Centro de presupuesto** (`budget`) | Asignación por categoría y ejecución mensual | `db.budgets`, `budgetVersions` | Anillo de uso, estado «dentro del límite» | `v285BudgetExecution` (`2381`), `v290BudgetSnapshot` (`719`) | `finance_*` |
| **Agenda de servicios** (`payments`/`recurring`) | Suscripciones, vencimientos de tarjetas/préstamos | `db.recurring`, cortes | Lista por fecha, botón «Pagar» | `payments` (`1487`), `recurring` (`2275`), `v40ProcessDue` (`8097`) | `finance_*` |
| **Comprobante** | Adjuntar recibo a un movimiento, cifrado local | Archivo, `txId` | Documento en el estado `smart360` | `v31SaveReceipt/Open/Remove` (`6674-6676`) | `[POR CONFIRMAR]` dónde se guarda el binario: el código usa el estado `v31` (`6595`) |
| **Herramientas adicionales** | `[POR CONFIRMAR]`: no existe pantalla con ese nombre; las utilidades están en Analítica avanzada (`advanced`, `app.js:3891`), Ajustes y Conciliación (`v31*`) | — | Excel anual, importación de extractos | `advancedCsv` (`app.js:3912`), `v31ParseCSV` (`6546`) | — |
| **Compras de Apple Pay («Por sincronizar»)** | Vincular tarjeta, mostrar bandeja, importar como movimiento | Eventos `apple_pay_events` | Movimientos `card_charge` con categoría «Apple Pay» | `v212*` (`12512-12700`, `12852-12900`), `v5NeedsAppleCategory` (`12825`) | `apple_pay_links`, `apple_pay_events`, funciones `apple-pay-link`, Realtime |
| **Movimientos** | Libro mayor con filtros; detalle de movimiento | `recentTx()` | Tabla, tarjetas móviles, vista de detalle (`v708`) | `transactions` (`2258`), `v6WalletTransactionDetail` (`1064`) | `finance_*` |
| **Registro de movimientos** | Formularios guiados (ingreso, gasto, transferencia, tarjeta, servicio) | Campos del formulario | `saveTx` → `db` | `FLOW_CATALOG` (`4422`), `guidedTransactionForm` (`4765`), `openMobileQuickRegister` (`4473`) | RPC `finance_apply_changes` al sincronizar |
| **Cuentas / Tarjetas / Préstamos / Certificados / Instituciones** | Productos y su detalle | `db.*` | Estado de cuenta, historial, amortización | `accounts`(`3002`), `cards`(`3010`), `loans`(`1889`), `certificates`(`3872`), `banks`(`1228`) | `finance_*` |
| **Entre personas** | Préstamos entre personas | `db.personalLoans` | Saldos pendientes | `personal` (`1431`) | `finance_*` |
| **Patrimonio / Proyección / Presión** | Evolución del patrimonio y calendario de caja | Cierres mensuales | Gráficas | `patrimonyWorld`(`3511`), `v134WealthWorld`(`3710`), `v360PressurePage`(`14117`) | `finance_*` |
| **Wallet (móvil)** | Galería de tarjetas | `db.cards` | Detalle y actividad | `v68Wallet` (`1091`) | `finance_*` |
| **Ajustes y sesión** | Tema, acento, tipo de cambio, copias, cierre de sesión | `db.settings` | Preferencias | `f34UpdateFx` (`7084`), `auth.signOut` (`7515`) | Auth, APIs de tipo de cambio |
