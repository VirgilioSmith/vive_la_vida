# Matriz de sensibilidad de VIVE SCORE (generada)

Perfil base de demostración: **666 puntos**. Cada fila cambia **una sola variable**; las columnas muestran el efecto total y por factor (pagos `payment`, deuda `owed`, antigüedad `age`, crédito nuevo `new`, composición `mix`). Datos sintéticos; no representan a ninguna persona. Regenerar: `MATRIZ=1 node tests/vive-score-propiedades.js`.

| Variable | Efecto total | Por factor |
|---|---|---|
| Utilización agregada +10 pp | 0 | payment 0 · owed 0 · age 0 · new 0 · mix 0 |
| Pago total de todas las tarjetas | +1 | payment 0 · owed +1 · age 0 · new 0 · mix 0 |
| +1 mora declarada de 30–59 d | -70 | payment -70 · owed 0 · age 0 · new 0 · mix 0 |
| +1 mora declarada de 60–89 d | -70 | payment -70 · owed 0 · age 0 · new 0 · mix 0 |
| +1 mora declarada de 90–119 d | -70 | payment -70 · owed 0 · age 0 · new 0 · mix 0 |
| Mora vigente de 30 d en una tarjeta (frente a 0 d) | -97 | payment ver total |
| Mora vigente de 90 d en una tarjeta (frente a 0 d) | -170 | payment ver total |
| Mora vigente de 672 d en una tarjeta (frente a 0 d) | -200 | payment ver total |
| +12 meses de antigüedad | +13 | payment 0 · owed 0 · age +13 · new 0 · mix 0 |
| +1 apertura reciente | -15 | payment 0 · owed 0 · age 0 · new -15 · mix 0 |
| +1 aumento de límite solicitado | -8 | payment 0 · owed 0 · age 0 · new -8 · mix 0 |
| Préstamo nuevo de RD$100,000 sin amortizar | 0 | payment 0 · owed 0 · age 0 · new 0 · mix 0 |
| Avance de efectivo del 25 % del límite | -3 | payment 0 · owed -3 · age 0 · new 0 · mix 0 |
| Tipo de cambio +20 % | 0 | payment 0 · owed 0 · age 0 · new 0 · mix 0 |
| Ingresos ×10 | 0 | payment 0 · owed 0 · age 0 · new 0 · mix 0 |
| Liquidez ×100 | 0 | payment 0 · owed 0 · age 0 · new 0 · mix 0 |

Barrido de utilización (0, 1, 5, 10, 20, 30, 50, 75, 100, 120, 150 %): 864, 864, 863, 860, 845, 830, 779, 709, 645, 621, 621.
Barrido de días de atraso vigente (0, 1, 15, 29, 30, 60, 90, 180): 866, 840, 837, 833, 769, 738, 696, 666.
