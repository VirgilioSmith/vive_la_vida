/* VIVE · Guardián de sincronización: evita inundar Supabase con revisiones obsoletas.
   Nunca devuelve éxito falso, modifica movimientos ni omite las comprobaciones de la RPC. */
(() => {
  'use strict';
  const sdk = window.supabase;
  if (!sdk || typeof sdk.createClient !== 'function' || sdk.__viveFinanceRpcGuard) return;

  const nativeCreateClient = sdk.createClient;
  sdk.createClient = function (...factoryArgs) {
    const client = nativeCreateClient.apply(this, factoryArgs);
    if (!client || typeof client.rpc !== 'function' || client.__viveFinanceRpcGuard) return client;
    client.__viveFinanceRpcGuard = true;

    const nativeRpc = client.rpc.bind(client);
    const active = new Set();
    const transientUntil = new Map();
    const rejectedUntil = new Map();
    const delayedErrors = new Map();
    let obsolete = false; // versión rechazada por el servidor (VI001): bloqueo definitivo, sin tocar la red
    const SUPPRESSION_MS = 20 * 60 * 1000;
    const RETRY_RESPONSE_DELAY_MS = 15 * 1000;

    function conflictResponse() {
      // Un rechazo local NO confirma escrituras: el cliente debe reconciliar
      // la última revisión antes de intentar guardar de nuevo.
      return {
        data: null,
        error: {
          code: '40001',
          message: 'CONFLICT: revisión obsoleta. Se bloqueó el reenvío repetido para proteger Supabase; reconcilia los cambios pendientes.',
          details: 'La revisión ya fue rechazada o consumida; ninguna escritura adicional se envió.',
          hint: 'Actualizar la revisión desde el servidor antes de repetir la operación.'
        },
        count: null,
        status: 409,
        statusText: 'Conflict'
      };
    }

    function delayedConflict(revision) {
      if (delayedErrors.has(revision)) return delayedErrors.get(revision);
      // Evita un bucle local de microtareas aunque la versión antigua de la app
      // no respete el backoff. Las solicitudes suprimidas no tocan la red.
      const promise = new Promise(resolve => {
        setTimeout(() => resolve(conflictResponse()), RETRY_RESPONSE_DELAY_MS);
      });
      delayedErrors.set(revision, promise);
      void promise.then(() => {
        if (delayedErrors.get(revision) === promise) delayedErrors.delete(revision);
      });
      return promise;
    }

    client.rpc = function (name, params, options) {
      if (name !== 'finance_apply_changes') return nativeRpc(name, params, options);
      if (obsolete) return Promise.resolve({ data: null, error: { code: 'VI001', message: 'VERSION_OBSOLETE: esta versión de Vive ya no puede guardar; actualiza la app.' }, count: null, status: 409, statusText: 'Conflict' });
      const expected = Number(params?.p_expected_revision);
      if (!Number.isSafeInteger(expected) || expected < 0) return nativeRpc(name, params, options);

      const key = String(expected);
      if (active.has(key) || (rejectedUntil.get(key) || 0) > Date.now()) {
        return delayedConflict(key);
      }
      if ((transientUntil.get(key) || 0) > Date.now()) {
        return new Promise(resolve => setTimeout(() => resolve({data:null,error:{code:'57014',message:'Supabase temporalmente ocupado; guardado pendiente.'},count:null,status:503,statusText:'Service Unavailable'}), RETRY_RESPONSE_DELAY_MS));
      }
      transientUntil.delete(key);
      active.add(key);
      let request;
      try {
        request = nativeRpc(name, params, options);
      } catch (err) {
        active.delete(key);
        throw err;
      }

      return Promise.resolve(request).then(result => {
        active.delete(key);
        if (String(result?.error?.code || '') === 'VI001' || /VERSION_OBSOLETE/.test(String(result?.error?.message || ''))) obsolete = true;
        const conflict = String(result?.error?.code || '') === '40001'
          || /CONFLICT:\s*la revisión remota cambió/i.test(String(result?.error?.message || ''));
        const consumed = !result?.error && Number(result?.data) > expected;
        if (conflict || consumed) rejectedUntil.set(key, Date.now() + SUPPRESSION_MS);
        // Backoff for transient overload: do not resend the same revision immediately.
        else if ([429, 502, 503, 504].includes(Number(result?.status)) || ['57014','55P03','53300'].includes(String(result?.error?.code || ''))) {
          transientUntil.set(key, Date.now() + 60000);
        }
        // Mantener el historial acotado incluso en una sesión prolongada.
        if (rejectedUntil.size > 64) {
          for (const [revision, until] of rejectedUntil) {
            if (until <= Date.now() || rejectedUntil.size > 48) rejectedUntil.delete(revision);
          }
        }
        return result;
      }, err => {
        active.delete(key);
        throw err;
      });
    };

    // No reutilizar un bloqueo cuando otra persona inicia sesión en el equipo.
    if (typeof client.auth?.onAuthStateChange === 'function') {
      let previousUser;
      client.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id || null;
        if (previousUser === undefined) { previousUser = uid; return; }
        if (previousUser !== uid) {
          previousUser = uid;
          rejectedUntil.clear();
          delayedErrors.clear();
          active.clear();
          transientUntil.clear();
        }
      });
    }
    return client;
  };
  sdk.__viveFinanceRpcGuard = true;
})();
