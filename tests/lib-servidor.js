/* Servidor Supabase simulado en memoria (solo pruebas): modelo relacional de finance_items/finance_values/finance_revision, RPC finance_apply_changes
   con control de revisión (CONFLICT 40001) y modos de fallo inyectables. Sin red ni datos reales. */
const esc = s => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
function flatten(value, path = '', out = []) {
  if (Array.isArray(value)) { out.push({ path, kind: 'array' }); value.forEach((v, i) => flatten(v, path + '/' + i, out)); }
  else if (value && typeof value === 'object') { out.push({ path, kind: 'object' }); for (const [k, v] of Object.entries(value)) if (v !== undefined) flatten(v, path + '/' + esc(k), out); }
  else if (typeof value === 'string') out.push({ path, kind: 'string', text_value: value });
  else if (typeof value === 'number') out.push({ path, kind: 'number', number_value: value });
  else if (typeof value === 'boolean') out.push({ path, kind: 'boolean', boolean_value: value });
  else out.push({ path, kind: 'null' });
  return out;
}
class Servidor {
  constructor() { this.rev = 0; this.exists = false; this.items = new Map(); this.mode = 'ok'; this.latency = 0; this.calls = []; this.reads = 0; this.commits = 0; this.modeUntilCalls = null; this.log = []; }
  setMode(mode, n = null) { this.mode = mode; this.modeUntilCalls = n; }
  async rpc(args, who) {
    this.calls.push({ who, expected: args.p_expected_revision, v: args.p_client_version, n: (args.p_changes || []).length, mode: this.mode });
    if (this.latency) await new Promise(r => setTimeout(r, this.latency));
    const m = this.mode;
    if (this.modeUntilCalls !== null && --this.modeUntilCalls <= 0) { this.mode = 'ok'; this.modeUntilCalls = null; }
    const http = c => ({ data: null, error: { status: c, code: String(c), message: ({ 401: 'JWT expired', 403: 'permission denied', 429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable' })[c] } });
    if (m === 'offline') return { __throw: 'TypeError: Failed to fetch' };
    if ([401, 403, 429, 500, 503].includes(+m)) return http(+m);
    if (m === 'incompleta') return { data: null, error: null };
    if (m === 'basura') return { data: 'abc', error: null };
    /* Política de versión mínima (supabase/migrations/20261126000000_politica_version_minima.sql) */
    if (this.legacy && 'p_client_version' in args) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.finance_apply_changes(p_changes, p_client_version, p_expected_revision) in the schema cache' } };
    if (Number(args.p_client_version || 0) < (this.minClientVersion || 0)) return { data: null, error: { code: 'VI001', message: `VERSION_OBSOLETE: esta versión de Vive ya no puede guardar; actualiza la app (mínima ${this.minClientVersion}, la tuya ${Number(args.p_client_version || 0)})` } };
    const apply = () => {
      if (this.rev !== Number(args.p_expected_revision)) return { data: null, error: { code: '40001', message: `CONFLICT: la revisión remota cambió (${this.rev} vs ${args.p_expected_revision})` } };
      for (const c of args.p_changes) { const k = c.collection + '\u0000' + c.id; if (c.action === 'delete') this.items.delete(k); else this.items.set(k, { collection: c.collection, record_id: c.id, position: c.position || 0, data: JSON.parse(JSON.stringify(c.data)) }); }
      this.rev++; this.exists = true; this.commits++; return { data: this.rev, error: null };
    };
    const r = apply();
    if (m === 'respuesta-perdida' && r.data) return { __throw: 'TypeError: Failed to fetch' }; // se aplicó en el servidor pero el cliente no lo supo
    return r;
  }
  read({ table, range, single, maybe, cols }) {
    this.reads++;
    if (this.readMode && this.readMode !== 'ok') return { data: null, error: { status: +this.readMode, code: String(this.readMode), message: 'fallo de lectura simulado' } };
    if (table === 'finance_revision') { if (!this.exists) return maybe ? { data: null, error: null } : { data: null, error: { code: 'PGRST116', message: 'sin filas' } }; return { data: single || maybe ? { revision: this.rev } : [{ revision: this.rev }], error: null }; }
    if (table === 'finance_collection_state') return { data: [], error: null };
    let rows = [];
    if (table === 'finance_items') rows = [...this.items.values()].map(i => ({ collection: i.collection, record_id: i.record_id, position: i.position }));
    else if (table === 'finance_values') for (const i of this.items.values()) for (const f of flatten(i.data)) rows.push({ collection: i.collection, record_id: i.record_id, path: f.path, kind: f.kind, text_value: f.text_value ?? null, number_value: f.number_value ?? null, boolean_value: f.boolean_value ?? null });
    else rows = [];
    rows.sort((a, b) => (a.collection + a.record_id + (a.path || '')).localeCompare(b.collection + b.record_id + (b.path || '')));
    if (range) rows = rows.slice(range[0], range[1] + 1);
    return { data: rows, error: null };
  }
  /* Documento tal y como lo vería otro cliente (para comprobar contenido) */
  doc() { const out = {}; for (const i of [...this.items.values()].sort((a, b) => a.position - b.position)) { if (i.record_id === '__root__') out[i.collection] = i.data; else (out[i.collection] ??= []).push(i.data); } return out; }
}
module.exports = { Servidor };
