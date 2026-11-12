/* POST /api/submit: every form on the site and the NURA assistant send here.
   1. checks the spam traps   2. gives the request a reference number   3. stores it (D1) and its file (KV)
   4. emails the team with Reply-To set to the sender   5. confirms to the sender   6. answers with the reference */
import { json, esc, clean, isEmail, TYPES, config, newRef, ensureSchema, sendEmail, spamCheckPassed } from '../_shared/lib.js';

const MAX_FILE = 10 * 1024 * 1024;
const FILE_OK = /\.(pdf|docx?|xlsx?|png|jpe?g|dwg|dxf|step|stp|zip)$/i;
const RESUME_OK = /\.(pdf|docx?)$/i;
// extra fields each form may send, with the label used in the email and the inbox
const EXTRA = { topic: 'Topic', request_type: 'Request', service: 'Service', site_city: 'Site city', timeline: 'Timeline', position: 'Position', link: 'Link', transcript: 'Assistant transcript' };

export async function onRequestPost({ request, env, waitUntil }) {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  const fail = (status, error) => wantsJson ? json({ ok: false, error }, status) : new Response(error, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const cfg = config(env);

  let form;
  try { form = await request.formData(); } catch { return fail(400, 'The form could not be read.'); }
  const get = (k, max) => clean(form.get(k), max);

  const type = get('form');
  if (!TYPES[type]) return fail(400, 'Unknown form.');

  // spam traps: a hidden field only bots fill in, and a form sent faster than a person can type
  if (get('website')) return wantsJson ? json({ ok: true, ref: 'TNY-0' }) : Response.redirect(new URL('/thanks/', request.url), 303);
  const t0 = Number(get('t0'));
  if (t0 > 0 && Date.now() - t0 < 2500) return fail(400, 'That was very quick. Please wait a moment and send it again.');
  if (!(await spamCheckPassed(env, get('cf-turnstile-response', 4000), request.headers.get('cf-connecting-ip')))) return fail(400, 'The spam check did not pass. Please try again.');

  const rec = {
    name: get('name', 120), email: get('email', 254).toLowerCase(), phone: get('phone', 40), company: get('company', 160),
    subject: get('subject', 200), message: get('message', 6000), page: get('page', 200), source: get('source', 30) || 'form',
  };
  if (!rec.name) return fail(400, 'Please enter your name.');
  if (!isEmail(rec.email)) return fail(400, 'Please enter a valid email address.');
  if (!rec.message && type !== 'application') return fail(400, 'Please enter a message.');

  const details = {};
  for (const k of Object.keys(EXTRA)) { const v = get(k, k === 'transcript' ? 6000 : 300); if (v) details[k] = v; }

  const ref = newRef(TYPES[type].code);
  const file = form.get('attachment');
  let fileMeta = null, fileSaved = null;
  if (file && typeof file === 'object' && file.size > 0) {
    if (file.size > MAX_FILE) return fail(400, 'The attachment is over 10 MB. Please send a smaller file.');
    if (!(type === 'application' ? RESUME_OK : FILE_OK).test(file.name || '')) return fail(400, type === 'application' ? 'Please attach your resume as a PDF or Word file.' : 'That file type is not accepted. Please send a PDF, Office file, image, CAD file or zip.');
    fileMeta = { name: clean(file.name, 160), size: file.size, type: clean(file.type, 100) || 'application/octet-stream' };
    fileSaved = false;
    if (env.FILES) {
      try { await env.FILES.put('file:' + ref, await file.arrayBuffer(), { metadata: fileMeta }); fileSaved = true; }
      catch (err) { console.error('file not saved', err.message); }
    }
  } else if (type === 'application') return fail(400, 'Please attach your resume.');

  const now = new Date().toISOString(), country = request.cf && request.cf.country ? request.cf.country : '';
  let stored = false;
  if (env.DB) {
    try {
      await ensureSchema(env.DB);
      await env.DB.prepare(`INSERT INTO submissions (ref, type, status, created_at, name, email, phone, company, subject, message, details, page, country, source, file_name, file_size, file_type)
        VALUES (?1, ?2, 'new', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`)
        .bind(ref, type, now, rec.name, rec.email, rec.phone, rec.company, rec.subject, rec.message, JSON.stringify(details), rec.page, country, rec.source,
          fileSaved ? fileMeta.name : null, fileSaved ? fileMeta.size : null, fileSaved ? fileMeta.type : null).run();
      stored = true;
    } catch (err) { console.error('not stored', err.message); }
  }

  // the email the team reads: who, what, and one click to reply or open the record
  const label = TYPES[type].label, inbox = `${cfg.site}/admin/#${ref}`;
  const headline = details.position || details.service || details.topic || rec.subject || rec.message.slice(0, 70);
  const rows = [['Name', rec.name], ['Email', rec.email], ['Phone', rec.phone], ['Company', rec.company], ['Subject', rec.subject],
    ...Object.entries(details).filter(([k]) => k !== 'transcript').map(([k, v]) => [EXTRA[k], v]),
    ['Sent from', [rec.page, country, rec.source === 'assistant' ? 'via NURA' : ''].filter(Boolean).join(' · ')],
    ['Attachment', fileMeta ? `${fileMeta.name} (${Math.round(fileMeta.size / 1024)} KB)` + (fileSaved ? ', open it from the inbox' : ', NOT saved: ask the sender to email it') : '']].filter(r => r[1]);
  const text = `${label} ${ref}\n\n${rows.map(r => `${r[0]}: ${r[1]}`).join('\n')}\n\nMessage:\n${rec.message || '(none)'}\n${details.transcript ? `\nAssistant transcript:\n${details.transcript}\n` : ''}\nReply to this email to answer ${rec.name} directly.\nInbox: ${inbox}\n`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#16293A;max-width:640px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0077B6">${esc(label)}</p>
<h2 style="margin:0 0 14px;font-size:20px">${esc(ref)}</h2>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">${rows.map(r => `<tr><td style="padding:6px 12px 6px 0;color:#5E707F;vertical-align:top;white-space:nowrap">${esc(r[0])}</td><td style="padding:6px 0">${esc(r[1])}</td></tr>`).join('')}</table>
<p style="margin:18px 0 6px;color:#5E707F">Message</p>
<div style="white-space:pre-wrap;border-left:3px solid #00B4D8;padding:4px 0 4px 14px">${esc(rec.message || '(none)')}</div>
${details.transcript ? `<p style="margin:18px 0 6px;color:#5E707F">Assistant transcript</p><div style="white-space:pre-wrap;font-size:13px;color:#2B3947;background:#F4F6F8;padding:12px">${esc(details.transcript)}</div>` : ''}
<p style="margin:22px 0 0"><strong>Reply to this email</strong> to answer ${esc(rec.name)} directly, or <a href="${esc(inbox)}" style="color:#0077B6">open the record in the inbox</a>.</p></div>`;

  const mailed = await sendEmail(env, {
    to: type === 'application' ? cfg.hr : cfg.to, cc: cfg.cc, replyTo: rec.email,
    subject: `[${label} ${ref}] ${rec.company || rec.name}: ${headline}`.slice(0, 180), html, text,
  });

  if (!stored && !mailed) return fail(503, 'This form is not able to deliver messages right now.');

  // confirmation to the sender, sent after the response so the page does not wait for it
  const confirmation = Boolean(env.RESEND_API_KEY) && env.SEND_CONFIRMATION !== 'off';
  if (confirmation) {
    const what = type === 'application' ? `your application for ${details.position || 'the role'}` : type === 'quote' ? 'your quote request' : 'your message';
    waitUntil(sendEmail(env, {
      to: rec.email, replyTo: type === 'application' ? cfg.hr : cfg.to, subject: `We received ${what} (${ref})`,
      text: `Hello ${rec.name},\n\nThank you. We received ${what}. Your reference is ${ref}.\n\nA person will reply within one business day. If you need to add anything, reply to this email and keep the reference in the subject.\n\nTECHNYAH\n${cfg.site}\n`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#16293A;max-width:560px"><p>Hello ${esc(rec.name)},</p><p>Thank you. We received ${esc(what)}.</p><p style="font-size:18px;margin:18px 0">Your reference: <strong>${esc(ref)}</strong></p><p>A person will reply within one business day. If you need to add anything, reply to this email and keep the reference in the subject.</p><p style="margin-top:24px">TECHNYAH<br><a href="${esc(cfg.site)}" style="color:#0077B6">${esc(cfg.site.replace(/^https?:\/\//, ''))}</a></p></div>`,
    }));
  }

  return wantsJson ? json({ ok: true, ref, stored, mailed, confirmation, fileSaved })
    : Response.redirect(new URL(`/thanks/?ref=${ref}`, request.url), 303);
}

export const onRequestGet = () => json({ ok: false, error: 'Send the form with POST.' }, 405);
