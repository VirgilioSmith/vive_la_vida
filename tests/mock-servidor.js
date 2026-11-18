(function () {
  const user = { id: '00000000-0000-0000-0000-000000000001', email: 'demo@example.com' };
  const res = v => Promise.resolve(v);
  const call = (op, p) => window.__srv ? window.__srv(op, p, window.__who || 'A') : res({ data: null, error: { message: 'servidor de pruebas no disponible' } });
  function q(table) {
    const st = { table };
    const p = new Proxy(function () { }, {
      get(t, k) {
        if (k === 'then') { return (a, b) => call('read', { table: st.table, range: st.range, single: st.single, maybe: st.maybe }).then(a, b); }
        if (k === 'range') return (a, b2) => { st.range = [a, b2]; return p; };
        if (k === 'single') return () => { st.single = true; return p; };
        if (k === 'maybeSingle') return () => { st.maybe = true; return p; };
        return () => p;
      }
    });
    return p;
  }
  const subs = new Set();
  const chan = { on(_, __, cb) { subs.add(cb); return chan }, subscribe(cb) { setTimeout(() => cb && cb('SUBSCRIBED'), 10); return chan }, unsubscribe() { } };
  window.__chanFire = () => subs.forEach(cb => { try { cb({ eventType: 'UPDATE' }) } catch (_) { } });
  window.supabase = {
    createClient() {
      return {
        auth: { getUser: () => res({ data: { user }, error: null }), getSession: () => res({ data: { session: { user, access_token: 'x' } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { } } } }), signOut: () => res({}), refreshSession: () => res({ data: { session: { user } }, error: null }) },
        from: q,
        rpc: async (name, args) => { const r = await call('rpc', args); if (r && r.__throw) throw new TypeError('Failed to fetch'); return r; },
        channel: () => chan, removeChannel: () => res(), removeAllChannels: () => res(), functions: { invoke: () => res({ data: null, error: null }) }, storage: { from: () => ({ upload: () => res({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) }
      };
    }
  };
})();
