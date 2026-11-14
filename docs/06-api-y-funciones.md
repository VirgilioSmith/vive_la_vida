# 06 · API y funciones

Código fuente de las funciones: **solo en el proyecto Supabase**, no en el repositorio `[POR CONFIRMAR]` control de versiones. Leído con la herramienta de Supabase el 14-nov-2026. Las tres tienen `verify_jwt=false` (autentican por su cuenta).

## `apple-pay-link` (v8)
| Aspecto | Detalle |
|---|---|
| Métodos | `POST` (emitir/rotar token), `DELETE` (revocar vínculo), `OPTIONS` |
| Autenticación | `Authorization: Bearer <JWT del usuario>` validado con `admin.auth.getUser` |
| Cuerpo POST | `instrument_type='card'`, `instrument_id`, `currency` (DOP/USD), `card_label` (≤120) |
| Cuerpo DELETE | `link_id` (UUID) → RPC `apple_pay_remove_link` |
| Verificación de propiedad | La tarjeta debe existir en `finance_items` del usuario (`collection='cards'`) |
| Respuesta OK | `link_id`, `token` (se muestra **una sola vez**, `<REDACTADO>`), `webhook_url`, `shortcuts_url` |
| Errores | 401 `missing_user_jwt`/`invalid_user_jwt`; 400 `invalid_json`; 413 `body_too_large` (>8 KB); 422 `invalid_card`/`invalid_link_id`; 403 `card_not_owned`; 409 `duplicate_links_need_review`; 404 `link_not_found`; 500 `…_failed`; 503 `server_config` |
| CORS | `Access-Control-Allow-Origin: *` |

## `apple-pay-shortcuts` (v4)
Adaptador para Atajos: normaliza importes de Wallet (`RD$1,400.00`, `140,00`, etc.) y reenvía a `apple-pay-ingest`.
| Aspecto | Detalle |
|---|---|
| Autenticación | Cabecera `x-vive-token` con formato `vhap_` + 64 hex (solo valida formato; el valor lo verifica `ingest`) |
| Validación | `content-type` JSON (415), tamaño ≤16 KB (413), `merchant` 1–200, importe/moneda, `event_id` ≤150 con patrón, `transaction_time` ISO |
| Salida | Respuesta de `ingest` + `adapter:true`; timeout de 14 s al llamar a `ingest`; 502 si no responde |
| Errores | `invalid_token` 401, `json_required` 415, `body_too_large` 413, `invalid_*`/`missing_*` 422, `invalid_json` 400, `upstream_invalid_response` 502, `ingest_unreachable` 502, `server_configuration` 503 |

## `apple-pay-ingest` (v12)
| Aspecto | Detalle |
|---|---|
| Autenticación | `x-vive-token` → SHA-256 → búsqueda en `apple_pay_links.token_hash` con `active=true` (sin coincidencia: 401 `link_revoked`) |
| Cuerpo | `amount` (>0, 2 decimales), `merchant` (≤140), `currency` (= la de la vinculación), `event_id` (`[\w:.-]{1,150}`), `transaction_time` opcional, `dry_run` |
| Idempotencia | Busca por `(link_id, event_id)`; si existe y coincide → `duplicate:true` sin insertar; si difiere → 409 `event_id_conflict`; carrera por índice único `23505` resuelta releyendo |
| Escritura | `insert` en `apple_pay_events` con clave de servicio (`status='pending'`) |
| Errores | 401 `invalid_token`/`link_revoked`; 405; 413; 400 `invalid_json`; 422 `invalid_fields`/`currency_mismatch`/`missing_event_id`/`invalid_transaction_time`; 409; 500 `link_lookup_failed`/`event_lookup_failed`/`event_insert_failed`; 503 `server_config` |
| CORS | `*` |

## RPC de datos usadas por el cliente
| RPC | Quién | Uso |
|---|---|---|
| `finance_apply_changes` | Usuario autenticado | Escritura de cambios con control de revisión (`app.js:7670`) |
| REST `finance_*`, `apple_pay_*` | Usuario autenticado | Lecturas (`app.js:7642`, `12876`); borrado de eventos propios (`6887`) |

## APIs externas consumidas por el cliente
Frankfurter y `open.er-api.com` para el tipo de cambio (`app.js:7084-7100`).
