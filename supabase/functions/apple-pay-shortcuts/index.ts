/** Vive el hoy · apple-pay-shortcuts v5 (cableado Deno). */
import { handle } from './handler.mjs';
Deno.serve((request: Request) => handle(request, { origin: Deno.env.get('SUPABASE_URL') ?? '', fetch, log: (c, m) => console.error('apple_pay_shortcuts', c, JSON.stringify(m || {})) }));
