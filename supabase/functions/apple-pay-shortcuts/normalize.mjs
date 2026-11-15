/** Vive el hoy — Apple Wallet monetary normalization. No network or persistence. */
export class WalletFormatError extends Error {
  constructor(code, message) { super(message); this.name = 'WalletFormatError'; this.code = code; }
}
const currencyAliases = new Map([['DOP', 'DOP'], ['RD$', 'DOP'], ['RD＄', 'DOP'], ['USD', 'USD'], ['US$', 'USD'], ['US＄', 'USD']]);
function parseCurrency(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const result = currencyAliases.get(String(value).trim().toUpperCase());
  if (!result) throw new WalletFormatError('invalid_currency', 'Moneda no admitida; usa DOP o USD.');
  return result;
}
function decimalFromText(text) {
  const cleaned = text.trim().replace(/[  \s]/g, '');
  if (!/^\d[\d.,]*$/.test(cleaned)) throw new WalletFormatError('invalid_amount', 'El importe contiene caracteres inválidos.');
  let normalized;
  if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(cleaned)) normalized = cleaned.replace(/,/g, '');
  else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(cleaned)) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(?:\.\d{1,2})?$/.test(cleaned)) normalized = cleaned;
  else if (/^\d+,\d{1,2}$/.test(cleaned)) normalized = cleaned.replace(',', '.');
  else throw new WalletFormatError('ambiguous_amount', 'Formato ambiguo: revisa el importe original de Wallet.');
  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0 || number > 9999999999.99) throw new WalletFormatError('invalid_amount', 'Importe fuera del rango permitido.');
  const cents = Math.round(number * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents / 100 - number) > 1e-7) throw new WalletFormatError('invalid_amount', 'El importe debe tener dos decimales como máximo.');
  return cents / 100;
}
export function normalizeWalletAmount(value, hint) {
  const hintedCurrency = parseCurrency(hint);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new WalletFormatError('invalid_amount', 'Importe no numérico.');
    const amount = decimalFromText(String(value));
    if (!hintedCurrency) throw new WalletFormatError('missing_currency', 'Envía currency para importes numéricos.');
    return { amount, currency: hintedCurrency };
  }
  if (typeof value !== 'string') throw new WalletFormatError('missing_amount', 'El importe debe ser texto o número.');
  const raw = value.trim();
  if (raw.length > 100) throw new WalletFormatError('invalid_amount', 'El importe es demasiado largo.');
  const match = raw.match(/^(DOP|RD\s?\$|USD|US\s?\$)\s*:?[ \t]*(.+)$/i);
  const prefix = match ? parseCurrency(match[1].replace(/\s/g, '')) : null;
  if (prefix && hintedCurrency && prefix !== hintedCurrency) throw new WalletFormatError('currency_conflict', 'La moneda del importe no coincide con currency.');
  const currency = prefix || hintedCurrency;
  if (!currency) throw new WalletFormatError('missing_currency', 'Falta la moneda; usa DOP o USD.');
  return { amount: decimalFromText(match ? match[2] : raw), currency };
}
export function normalizeWalletEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new WalletFormatError('invalid_payload', 'Envía un objeto JSON.');
  const merchant = String(input.merchant ?? input.comercio ?? '').trim().replace(/\s+/g, ' ');
  if (!merchant || merchant.length > 200) throw new WalletFormatError('invalid_merchant', 'merchant es obligatorio (1–200 caracteres).');
  const raw = input.amount_raw ?? input.amount ?? input.attachment_text;
  const money = normalizeWalletAmount(raw, input.currency ?? input.currency_hint ?? null);
  const dry_run = input.dry_run === true;
  const event_id = String(input.event_id ?? '').trim();
  if (!dry_run && (!event_id || event_id.length > 150)) throw new WalletFormatError('missing_event_id', 'Envía event_id estable para impedir duplicados en reintentos.');
  if (event_id && !/^[\w:.-]{1,150}$/.test(event_id)) throw new WalletFormatError('invalid_event_id', 'event_id solo permite letras, números, guiones, puntos y dos puntos.');
  const transaction_time = input.transaction_time == null ? null : String(input.transaction_time);
  if (transaction_time && (!Number.isFinite(Date.parse(transaction_time)) || transaction_time.length > 60)) throw new WalletFormatError('invalid_transaction_time', 'transaction_time debe ser ISO 8601.');
  return { amount: money.amount, merchant, currency: money.currency, ...(event_id ? { event_id } : {}), ...(transaction_time ? { transaction_time } : {}), ...(dry_run ? { dry_run: true } : {}) };
}
