/** Vive el hoy · apple-pay-shortcuts · adaptador Wallet/Atajos (sin acceso a la base de datos). */
import { normalizeWalletEvent, WalletFormatError } from './normalize.mjs';
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const respond = (body, status = 200) => new Response(JSON.stringify({ version: 'apple-pay-v3', ...body }), { status, headers: HEADERS });
/** deps: { origin (SUPABASE_URL), fetch, log } */
export async function handle(request, deps) {
  const log = deps.log || (() => {});
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
    if (request.method !== 'POST') return respond({ ok: false, code: 'method_not_allowed' }, 405);
    const token = request.headers.get('x-vive-token')?.trim() ?? '';
    if (!/^vhap_[a-f0-9]{64}$/.test(token)) return respond({ ok: false, saved: false, code: 'unauthorized' }, 401);
    if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) return respond({ ok: false, saved: false, code: 'json_required' }, 415);
    if (Number(request.headers.get('content-length') ?? '0') > 16384) return respond({ ok: false, saved: false, code: 'body_too_large' }, 413);
    let normalized;
    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).length > 16384) return respond({ ok: false, saved: false, code: 'body_too_large' }, 413);
      normalized = normalizeWalletEvent(JSON.parse(body));
    } catch (error) {
      if (error instanceof WalletFormatError) return respond({ ok: false, saved: false, code: error.code, error: error.message }, 422);
      return respond({ ok: false, saved: false, code: 'invalid_json' }, 400);
    }
    let endpoint;
    try {
      endpoint = new URL('/functions/v1/apple-pay-ingest', deps.origin ?? '');
      if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost') throw Error('insecure_origin');
    } catch { log('server_configuration', {}); return respond({ ok: false, saved: false, code: 'internal_error' }, 503); }
    try {
      const response = await (deps.fetch ?? fetch)(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vive-Token': token, 'X-Forwarded-For': request.headers.get('x-forwarded-for') || '' }, body: JSON.stringify(normalized), signal: AbortSignal.timeout(14000) });
      let data;
      try { const parsed = await response.json(); data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { data = null; }
      if (!data) return respond({ ok: false, saved: false, code: 'upstream_invalid_response' }, 502);
      const status = response.status >= 200 && response.status < 600 ? response.status : 502;
      return respond({ ...data, adapter: true }, status);
    } catch (error) {
      log('ingest_unreachable', { name: error?.name || 'Error' });
      return respond({ ok: false, saved: false, code: 'ingest_unreachable', error: 'Reintenta el mismo event_id; el estado de guardado es desconocido.' }, 502);
    }
  } catch (error) {
    log('unhandled', { name: error?.name || 'Error' });
    return respond({ ok: false, saved: false, code: 'internal_error' }, 500);
  }
}
