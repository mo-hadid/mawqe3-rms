/* TECHNYAH inbox: reads /api/admin/* with the access token. The token stays in this browser tab only. */
(function () {
  'use strict';
  var KEY = 'tny-admin-token', token = '';
  try { token = sessionStorage.getItem(KEY) || ''; } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var LABEL = { quote: 'Quote request', contact: 'Contact', ticket: 'Support ticket', application: 'Job application' };
  var EXTRA = { topic: 'Topic', request_type: 'Request', service: 'Service', site_city: 'Site city', timeline: 'Timeline', position: 'Position', link: 'Link' };
  var current = null, timer;

  function api(path, opts) {
    opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + token }, opts.headers || {});
    return fetch('/api/admin/' + path, opts).then(function (res) {
      if (opts.raw && res.ok) return res;
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok || !body.ok) { var err = new Error(body.error || 'Request failed (' + res.status + ').'); err.status = res.status; throw err; }
        return body;
      });
    });
  }
  var when = function (iso) { var d = new Date(iso); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };

  function health() {
    fetch('/api/health').then(function (r) { return r.json(); }).then(function (h) {
      $('health').innerHTML = [['storage', 'Storage'], ['files', 'Files'], ['email', 'Email'], ['spamCheck', 'Spam check']].map(function (k) {
        return '<span class="' + (h[k[0]] ? 'on' : 'off') + '" title="' + (h[k[0]] ? 'Working' : 'Not configured. See DEPLOY.md') + '">' + k[1] + (h[k[0]] ? '' : ' off') + '</span>';
      }).join('');
    }).catch(function () {});
  }

  function showLogin(message) {
    $('app').hidden = true; $('login').hidden = false; $('refresh').hidden = true; $('signout').hidden = true;
    var e = $('login-error'); e.textContent = message || ''; e.className = 'form-status err' + (message ? ' show' : '');
  }
  function load() {
    var q = new URLSearchParams({ type: $('f-type').value, status: $('f-status').value, q: $('f-q').value.trim() });
    return api('list?' + q).then(function (body) {
      $('login').hidden = true; $('app').hidden = false; $('refresh').hidden = false; $('signout').hidden = false;
      $('items').innerHTML = body.items.length ? body.items.map(function (it) {
        return '<button type="button" class="ad-item' + (it.ref === current ? ' sel' : '') + '" data-ref="' + esc(it.ref) + '"><span class="top"><span>' + esc(LABEL[it.type] || it.type) +
          (it.file_name ? ' · file' : '') + '</span><span>' + esc(when(it.created_at)) + '</span></span><strong>' + esc(it.company ? it.name + ', ' + it.company : it.name) +
          '</strong><p>' + esc(it.subject || it.preview || '') + '</p><span class="st ' + esc(it.status.replace(' ', '-')) + '">' + esc(it.status) + '</span></button>';
      }).join('') : '<p class="ad-empty">Nothing here yet.</p>';
    }).catch(function (err) { showLogin(err.status === 401 ? 'That token was not accepted.' : err.message); });
  }

  function open(ref) {
    current = ref; if (location.hash.slice(1) !== ref) history.replaceState(null, '', '#' + ref);
    Array.prototype.forEach.call(document.querySelectorAll('.ad-item'), function (b) { b.classList.toggle('sel', b.getAttribute('data-ref') === ref); });
    api('item?ref=' + encodeURIComponent(ref)).then(function (body) {
      var it = body.item, d = it.details || {};
      var reply = 'mailto:' + encodeURIComponent(it.email) + '?subject=' + encodeURIComponent('Re: [' + it.ref + '] ' + (it.subject || LABEL[it.type] || ''));
      var rows = [['Email', '<a href="mailto:' + esc(it.email) + '">' + esc(it.email) + '</a>'], ['Phone', esc(it.phone)], ['Company', esc(it.company)], ['Subject', esc(it.subject)]]
        .concat(Object.keys(EXTRA).filter(function (k) { return d[k]; }).map(function (k) { return [EXTRA[k], esc(d[k])]; }))
        .concat([['Received', esc(new Date(it.created_at).toLocaleString())], ['Sent from', esc([it.page, it.country, it.source === 'assistant' ? 'via NURA' : ''].filter(Boolean).join(' · '))]])
        .filter(function (r) { return r[1]; });
      $('detail').innerHTML = '<p class="eyebrow">' + esc(LABEL[it.type] || it.type) + ' · ' + esc(it.ref) + '</p><h2>' + esc(it.name) + '</h2>' +
        '<div class="ad-actions"><a class="cta-btn" href="' + reply + '">Reply by email</a>' +
        (it.file_name ? '<button type="button" class="btn-plain" id="dl">Download ' + esc(it.file_name) + ' (' + Math.max(1, Math.round(it.file_size / 1024)) + ' KB)</button>' : '') + '</div>' +
        '<dl class="ad-kv">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
        '<h4>Message</h4><div class="ad-msg">' + esc(it.message || '(none)') + '</div>' +
        (d.transcript ? '<h4 style="margin-top:18px">Assistant transcript</h4><div class="ad-msg" style="font-size:.88rem">' + esc(d.transcript) + '</div>' : '') +
        '<div class="ad-work"><label for="w-status"><strong>Status</strong></label><select id="w-status">' + ['new', 'in progress', 'waiting', 'closed'].map(function (s) { return '<option' + (s === it.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<label for="w-notes"><strong>Internal notes</strong></label><textarea id="w-notes" rows="4" placeholder="Visible only here">' + esc(it.notes || '') + '</textarea>' +
        '<div class="ad-actions" style="margin:0"><button type="button" class="cta-btn" id="save">Save</button><span class="muted" id="saved"></span><button type="button" class="btn-plain danger" id="del" style="margin-left:auto">Delete record</button></div></div>';
      $('save').addEventListener('click', function () {
        api('update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: ref, status: $('w-status').value, notes: $('w-notes').value }) })
          .then(function () { $('saved').textContent = 'Saved ' + new Date().toLocaleTimeString(); load(); }).catch(function (e) { $('saved').textContent = e.message; });
      });
      var armed = false;
      $('del').addEventListener('click', function () {
        if (!armed) { armed = true; this.textContent = 'Click again to delete for good'; return; }
        api('delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: ref }) })
          .then(function () { current = null; history.replaceState(null, '', location.pathname); $('detail').innerHTML = '<p class="ad-empty">Deleted.</p>'; load(); });
      });
      if ($('dl')) $('dl').addEventListener('click', function () {
        api('file?ref=' + encodeURIComponent(ref), { raw: true }).then(function (res) { return res.blob(); }).then(function (blob) {
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = it.file_name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        }).catch(function (e) { $('saved').textContent = e.message; });
      });
    }).catch(function (err) { $('detail').innerHTML = '<p class="ad-empty">' + esc(err.message) + '</p>'; });
  }

  $('login').addEventListener('submit', function (e) {
    e.preventDefault(); token = $('token').value.trim();
    try { sessionStorage.setItem(KEY, token); } catch (err) {}
    load().then(function () { if (location.hash.length > 1 && !$('app').hidden) open(location.hash.slice(1)); });
  });
  $('signout').addEventListener('click', function () { token = ''; try { sessionStorage.removeItem(KEY); } catch (e) {} $('token').value = ''; showLogin(''); });
  $('refresh').addEventListener('click', load);
  $('items').addEventListener('click', function (e) { var b = e.target.closest('.ad-item'); if (b) open(b.getAttribute('data-ref')); });
  ['f-type', 'f-status'].forEach(function (id) { $(id).addEventListener('change', load); });
  $('f-q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(load, 250); });

  health();
  if (token) load().then(function () { if (location.hash.length > 1 && !$('app').hidden) open(location.hash.slice(1)); }); else showLogin('');
})();
