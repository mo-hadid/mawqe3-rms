/* /api/admin/<action>: the private inbox behind /admin/. Every call needs "Authorization: Bearer <ADMIN_TOKEN>".
   list · item · update · delete · file · stats */
import { json, clean, ensureSchema, isAdmin, TYPES } from '../../_shared/lib.js';

const STATUSES = ['new', 'in progress', 'waiting', 'closed'];

export async function onRequest({ request, env, params }) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16) return json({ ok: false, error: 'The inbox is switched off. Add the ADMIN_TOKEN secret (16 characters or more) in Cloudflare.' }, 503);
  if (!(await isAdmin(request, env))) return json({ ok: false, error: 'Wrong or missing access token.' }, 401);
  if (!env.DB) return json({ ok: false, error: 'No database is connected. Add the D1 binding named DB in Cloudflare.' }, 503);
  await ensureSchema(env.DB);

  const url = new URL(request.url), action = params.action, db = env.DB;
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const ref = clean(url.searchParams.get('ref') || body.ref, 40);

  if (action === 'list' && request.method === 'GET') {
    const type = clean(url.searchParams.get('type'), 20), status = clean(url.searchParams.get('status'), 20), q = clean(url.searchParams.get('q'), 80);
    const where = [], args = [];
    if (TYPES[type]) { where.push('type = ?'); args.push(type); }
    if (STATUSES.includes(status)) { where.push('status = ?'); args.push(status); }
    if (q) { where.push('(ref LIKE ? OR name LIKE ? OR email LIKE ? OR company LIKE ? OR subject LIKE ? OR message LIKE ?)'); for (let i = 0; i < 6; i++) args.push(`%${q}%`); }
    const { results } = await db.prepare(`SELECT ref, type, status, created_at, name, email, company, subject, substr(message, 1, 140) AS preview, file_name
      FROM submissions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 200`).bind(...args).all();
    return json({ ok: true, items: results });
  }

  if (action === 'stats' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT status, COUNT(*) AS n FROM submissions GROUP BY status').all();
    return json({ ok: true, stats: Object.fromEntries(results.map(r => [r.status, r.n])), files: Boolean(env.FILES), email: Boolean(env.RESEND_API_KEY) });
  }

  if (!ref) return json({ ok: false, error: 'Missing reference.' }, 400);
  const item = await db.prepare('SELECT * FROM submissions WHERE ref = ?').bind(ref).first();
  if (!item) return json({ ok: false, error: 'No record with that reference.' }, 404);

  if (action === 'item' && request.method === 'GET') {
    try { item.details = JSON.parse(item.details || '{}'); } catch { item.details = {}; }
    return json({ ok: true, item });
  }

  if (action === 'update' && request.method === 'POST') {
    const status = STATUSES.includes(body.status) ? body.status : item.status, notes = clean(body.notes ?? item.notes ?? '', 4000);
    await db.prepare('UPDATE submissions SET status = ?, notes = ?, updated_at = ? WHERE ref = ?').bind(status, notes, new Date().toISOString(), ref).run();
    return json({ ok: true, status, notes });
  }

  if (action === 'delete' && request.method === 'POST') {
    await db.prepare('DELETE FROM submissions WHERE ref = ?').bind(ref).run();
    if (env.FILES) await env.FILES.delete('file:' + ref).catch(() => {});
    return json({ ok: true });
  }

  if (action === 'file' && request.method === 'GET') {
    if (!env.FILES || !item.file_name) return json({ ok: false, error: 'No file is stored for this record.' }, 404);
    const { value, metadata } = await env.FILES.getWithMetadata('file:' + ref, 'arrayBuffer');
    if (!value) return json({ ok: false, error: 'The file is no longer stored.' }, 404);
    const name = (metadata && metadata.name ? metadata.name : item.file_name).replace(/[^\w.\- ]+/g, '_');
    return new Response(value, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  }

  return json({ ok: false, error: 'Unknown action.' }, 404);
}
