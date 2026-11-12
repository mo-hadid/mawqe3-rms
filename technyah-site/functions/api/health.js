/* GET /api/health: which parts of the contact system are switched on. Shows no secrets, only yes or no. */
import { json } from '../_shared/lib.js';

export async function onRequestGet({ env }) {
  const status = {
    storage: Boolean(env.DB),             // D1 binding "DB": submissions are saved and appear in /admin/
    files: Boolean(env.FILES),            // KV binding "FILES": attachments are saved
    email: Boolean(env.RESEND_API_KEY),   // secret RESEND_API_KEY: notification and confirmation emails are sent
    spamCheck: Boolean(env.TURNSTILE_SECRET),
    inbox: Boolean(env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 16),
  };
  let database = null;
  if (env.DB) { try { await env.DB.prepare('SELECT 1').first(); database = 'reachable'; } catch (err) { database = 'error: ' + err.message; } }
  return json({ ok: status.storage || status.email, ...status, database, time: new Date().toISOString() });
}
