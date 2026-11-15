/** Base en memoria mínima con la forma de la API de supabase-js que usan las funciones. */
export function fakeAdmin(seed = {}, opts = {}) {
  const tables = { apple_pay_links: [], apple_pay_events: [], ...seed };
  let n = 0;
  const from = (name) => {
    const q = { filters: [], op: 'select', head: false, count: false, row: null, lim: null };
    const run = () => {
      if (opts.failOn === name) return { data: null, error: { code: 'XX000', message: 'detalle interno secreto' } };
      const rows = (tables[name] || []);
      if (q.op === 'insert') {
        const row = { id: 'id-' + (++n), received_at: new Date().toISOString(), ...q.row };
        if (name === 'apple_pay_events' && rows.some(r => r.link_id === row.link_id && r.event_id === row.event_id))
          return { data: null, error: { code: '23505', message: 'duplicate' } };
        rows.push(row); return { data: row, error: null };
      }
      let out = rows.filter(r => q.filters.every(f => f(r)));
      if (q.head) return { data: null, count: out.length, error: null };
      if (q.lim) out = out.slice(0, q.lim);
      return { data: out, error: null };
    };
    const api = {
      select() { return api; }, insert(row) { q.op = 'insert'; q.row = row; return api; },
      eq(c, v) { q.filters.push(r => r[c] === v); return api; }, gte(c, v) { q.filters.push(r => r[c] >= v); return api; },
      limit(k) { q.lim = k; return api; },
      maybeSingle() { const r = run(); return Promise.resolve(r.error ? r : { data: r.data[0] ?? null, error: null }); },
      single() { const r = run(); return Promise.resolve(r.error ? r : { data: Array.isArray(r.data) ? r.data[0] : r.data, error: null }); },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    Object.defineProperty(api, 'head', { set(v) { q.head = v; } });
    const origSelect = api.select; api.select = (cols, o) => { if (o?.head) q.head = true; return origSelect(); };
    return api;
  };
  return { from, tables };
}
