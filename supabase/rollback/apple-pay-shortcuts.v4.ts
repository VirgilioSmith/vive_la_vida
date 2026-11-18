/** Vive el hoy · Apple Pay v2: adaptador Wallet/Atajos, sin acceso a DB. */
import { normalizeWalletEvent, WalletFormatError } from './normalize.mjs';
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,x-vive-token',
  'Cache-Control': 'no-store',
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ version: 'apple-pay-v2', ...body }), { headers: HEADERS, status });
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== 'POST') return respond({ ok: false, code: 'method_not_allowed' }, 405);
  const token = request.headers.get('x-vive-token')?.trim() ?? '';
  if (!/^vhap_[a-f0-9]{64}$/.test(token)) return respond({ ok: false, saved: false, code: 'invalid_token' }, 401);
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json'))
    return respond({ ok: false, saved: false, code: 'json_required' }, 415);
  if (Number(request.headers.get('content-length') ?? '0') > 16384)
    return respond({ ok: false, saved: false, code: 'body_too_large' }, 413);
  let normalized;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 16384) return respond({ ok: false, saved: false, code: 'body_too_large' }, 413);
    normalized = normalizeWalletEvent(JSON.parse(body));
  } catch (error) {
    if (error instanceof WalletFormatError)
      return respond({ ok: false, saved: false, code: error.code, error: error.message }, 422);
    return respond({ ok: false, saved: false, code: 'invalid_json' }, 400);
  }
  const origin = Deno.env.get('SUPABASE_URL') ?? '';
  let endpoint: URL;
  try {
    endpoint = new URL('/functions/v1/apple-pay-ingest', origin);
    if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost') throw Error('insecure_origin');
  } catch { return respond({ ok: false, saved: false, code: 'server_configuration' }, 503); }
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vive-Token': token },
      body: JSON.stringify(normalized), signal: AbortSignal.timeout(14000),
    });
    let data: Record<string, unknown>;
    try {
      const parsed = await response.json();
      data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ok: false, code: 'upstream_invalid_response', saved: false };
    } catch { return respond({ ok: false, saved: false, code: 'upstream_invalid_response' }, 502); }
    return respond({ ...data, adapter: true }, response.status);
  } catch { return respond({ ok: false, saved: false, code: 'ingest_unreachable', error: 'Reintenta el mismo event_id; el estado de guardado es desconocido.' }, 502); }
});
