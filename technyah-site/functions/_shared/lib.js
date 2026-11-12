/* Shared helpers for the TECHNYAH API (Cloudflare Pages Functions).
   Bindings and secrets are set in the Cloudflare dashboard, never in this repository:
     DB (D1 database)        stores every submission             optional but recommended
     FILES (KV namespace)    stores uploaded files               optional
     RESEND_API_KEY (secret) sends the notification emails       optional
     TURNSTILE_SECRET        verifies the spam check             optional
     ADMIN_TOKEN (secret)    unlocks /admin/                     required for the inbox
   Each piece switches on when it is configured. /api/health reports which are active. */

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
export const clean = (v, max = 300) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
export const isEmail = s => /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(s) && s.length <= 254;

export const TYPES = {
  contact: { code: 'C', label: 'Contact' },
  quote: { code: 'Q', label: 'Quote request' },
  application: { code: 'A', label: 'Job application' },
  ticket: { code: 'T', label: 'Support ticket' },
};

export const config = env => ({
  from: env.MAIL_FROM || 'TECHNYAH <info@technyah.com>',
  to: env.MAIL_TO || 'info@technyah.com',
  hr: env.MAIL_HR || 'hr@technyah.com',
  cc: env.MAIL_CC || 'mhadid@technyah.com',
  site: env.SITE_URL || 'https://technyah.com',
});

/* TNY-Q-261112-7K3F: type, date, four characters that are easy to read aloud */
export function newRef(code) {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const abc = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', r = crypto.getRandomValues(new Uint8Array(4));
  return `TNY-${code}-${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${[...r].map(b => abc[b % 32]).join('')}`;
}

let schemaReady = false;
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS submissions (
      ref TEXT PRIMARY KEY, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL, updated_at TEXT,
      name TEXT, email TEXT, phone TEXT, company TEXT, subject TEXT, message TEXT, details TEXT,
      page TEXT, country TEXT, source TEXT, file_name TEXT, file_size INTEGER, file_type TEXT, notes TEXT)`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions (created_at DESC)'),
  ]);
  schemaReady = true;
}

/* Resend (https://resend.com/docs/api-reference/emails/send-email). Returns true when accepted. */
export async function sendEmail(env, { to, cc, replyTo, subject, html, text }) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: config(env).from, to: [].concat(to), ...(cc ? { cc: [].concat(cc) } : {}), ...(replyTo ? { reply_to: replyTo } : {}), subject, html, text }),
    });
    if (!res.ok) console.error('email rejected', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (err) { console.error('email failed', err.message); return false; }
}

export async function spamCheckPassed(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, ...(ip ? { remoteip: ip } : {}) });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return (await res.json()).success === true;
  } catch { return false; }
}

/* Admin requests carry "Authorization: Bearer <ADMIN_TOKEN>". Closed unless the secret is set. */
export async function isAdmin(request, env) {
  const expected = env.ADMIN_TOKEN, given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || expected.length < 16 || !given) return false;
  const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([h(expected), h(given)]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
