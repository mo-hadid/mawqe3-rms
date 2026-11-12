/* TECHNYAH site behaviour: navigation, search, page filters, forms. No inline scripts (strict CSP). */
(function () {
  'use strict';
  var TNY = window.TNY = window.TNY || {};
  var html = document.documentElement;
  var VER = html.getAttribute('data-v') || '';
  var EMAIL = html.getAttribute('data-email') || 'info@technyah.com';
  var SITEKEY = html.getAttribute('data-turnstile') || '';
  var E = TNY.Engine;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- mobile navigation ---------- */
  var burger = $('.hamburger-menu'), nav = $('.nav-links');
  if (burger && nav) burger.addEventListener('click', function () {
    burger.setAttribute('aria-expanded', nav.classList.toggle('active') ? 'true' : 'false');
  });

  /* ---------- shared data loaders (fetched once, on first use) ---------- */
  function once(url, make) {
    var p; return function () { return p || (p = fetch(url + '?v=' + VER).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }).then(make)); };
  }
  TNY.searchIndex = once('/search-index.json', function (docs) { return new E.Index(docs); });
  // service and industry pages outrank short answers when both match
  var rank = function (d) { return d.k === 'Service' ? 1.25 : d.k === 'Industry' ? 1.1 : d.k === 'Answer' ? 0.85 : 1; };
  TNY.assistantData = once('/assistant.json', function (d) { return d; });

  /* ---------- header search with ranked suggestions ---------- */
  $$('.header-search').forEach(function (form) {
    var input = $('.search-bar', form), box = $('.suggestions-dropdown', form), active = -1, timer;
    function close() { box.style.display = 'none'; active = -1; }
    function render(q) {
      TNY.searchIndex().then(function (idx) {
        if (input.value.trim() !== q) return;
        var res = idx.search(q, { limit: 6, prefixLast: true, boost: rank });
        box.innerHTML = res.map(function (r) {
          var d = r.doc, title = d.h && d.k !== 'Job' && d.k !== 'Answer' ? d.t + ' · ' + d.h : d.t;
          return '<div class="suggestion-item"><a href="' + d.u + '"><span class="s-kind">' + E.escapeHtml(d.k) + '</span><span class="s-title">' +
            E.escapeHtml(title) + '</span><span class="s-snip">' + E.snippet(d.x, r.terms, 110) + '</span></a></div>';
        }).join('') + '<div class="suggestion-item suggest-all"><a href="/search/?q=' + encodeURIComponent(q) + '">' +
          (res.length ? 'See all results' : 'No quick match. Search all pages') + '</a></div>';
        box.style.display = 'block'; active = -1;
      }).catch(close);
    }
    input.addEventListener('input', function () {
      var q = input.value.trim(); clearTimeout(timer);
      if (q.length < 2) return close();
      timer = setTimeout(function () { render(q); }, 90);
    });
    input.addEventListener('focus', function () { TNY.searchIndex().catch(function () {}); });
    input.addEventListener('keydown', function (e) {
      var links = $$('a', box);
      if (e.key === 'Escape') { close(); return; }
      if (box.style.display !== 'block' || !links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach(function (a, i) { a.classList.toggle('active', i === active); });
      } else if (e.key === 'Enter' && active > -1) { e.preventDefault(); window.location.href = links[active].href; }
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/input|textarea|select/i.test((e.target.tagName || '')) && !e.target.isContentEditable) {
      var s = $('.header-search .search-bar'); if (s && s.offsetParent) { e.preventDefault(); s.focus(); }
    }
  });

  /* ---------- /search/ results page ---------- */
  var results = $('#search-results');
  if (results) {
    var q = new URLSearchParams(location.search).get('q') || '', count = $('#search-count'), field = $('#search-q');
    if (field) field.value = q;
    if (q.trim()) TNY.searchIndex().then(function (idx) {
      var res = idx.search(q, { limit: 30, boost: rank });
      res = res.filter(function (r) { return r.score >= res[0].score * 0.3; });
      count.textContent = res.length ? res.length + (res.length === 1 ? ' result for “' : ' results for “') + q + '”' : 'Nothing found for “' + q + '”.';
      results.innerHTML = res.length ? res.map(function (r) {
        var d = r.doc;
        return '<a class="result" href="' + d.u + '"><span class="badge">' + E.escapeHtml(d.k) + '</span><h3>' + E.escapeHtml(d.t) +
          (d.h && d.k !== 'Answer' ? ' <span class="muted">· ' + E.escapeHtml(d.h) + '</span>' : '') + '</h3><span class="r-url">technyah.com' + E.escapeHtml(d.u) +
          '</span><p>' + E.snippet(d.x, r.terms, 220) + '</p></a>';
      }).join('') : '<p class="note">Try a different word, ask the assistant in the corner, or <a href="/contact/">send us the question</a>.</p>';
    }).catch(function () { count.textContent = 'Search could not load. Please try again.'; });
  }

  /* ---------- on-page filters (services, products, jobs) ---------- */
  $$('input.page-filter').forEach(function (input) {
    var empty = input.closest('.container').querySelector('.no-results');
    input.addEventListener('input', function () {
      var words = input.value.toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
      $$(input.getAttribute('data-target')).forEach(function (el) {
        var text = el.textContent.toLowerCase(), ok = words.every(function (w) { return text.indexOf(w) > -1; });
        el.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      if (empty) empty.style.display = shown ? 'none' : 'block';
    });
  });

  /* ---------- job accordions (and open the one named in the URL) ---------- */
  function toggleJob(header, open) {
    var body = document.getElementById(header.getAttribute('aria-controls'));
    open = open === undefined ? !body.classList.contains('open') : open;
    body.classList.toggle('open', open); header.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('.job-toggle-icon', header).textContent = open ? '−' : '+';
  }
  $$('.job-header').forEach(function (h) { h.addEventListener('click', function () { toggleJob(h); }); });
  function openHashTarget() {
    var el = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (!el) return;
    if (el.classList.contains('job-listing')) toggleJob($('.job-header', el), true);
    if (el.tagName === 'DETAILS') el.open = true;
    setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 30);
  }
  openHashTarget(); window.addEventListener('hashchange', openHashTarget);

  /* ---------- file inputs: show the choice and enforce 10 MB ---------- */
  $$('input[type="file"]').forEach(function (input) {
    input.addEventListener('change', function () {
      var note = input.parentElement.querySelector('.file-preview'), f = input.files[0];
      if (!note) return;
      if (!f) { note.textContent = ''; return; }
      if (f.size > 10 * 1024 * 1024) { note.style.color = 'var(--err)'; note.textContent = 'That file is over 10 MB. Please attach a smaller one.'; input.value = ''; return; }
      note.style.color = 'var(--ok)'; note.textContent = 'Attached: ' + f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB)';
    });
  });

  /* ---------- prefill forms from the URL (?service=, ?topic=, ?subject=) ---------- */
  var params = new URLSearchParams(location.search);
  [['service', '#q-service'], ['topic', '#c-topic'], ['subject', '#c-subject']].forEach(function (p) {
    var el = $(p[1]), v = params.get(p[0]); if (!el || !v) return;
    if (el.tagName === 'SELECT') { $$('option', el).forEach(function (o) { if (o.value === v || o.textContent === v) el.value = o.value; }); } else el.value = v;
  });
  var ref = $('#thanks-ref'); if (ref && params.get('ref')) ref.textContent = params.get('ref');

  /* ---------- Cloudflare Turnstile (only when a site key is configured) ---------- */
  var tsLoading;
  TNY.spamToken = function (slot) {
    if (!SITEKEY) return Promise.resolve('');
    tsLoading = tsLoading || new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
      s.onload = resolve; s.onerror = function () { reject(new Error('spam check could not load')); };
      document.head.appendChild(s);
    });
    return tsLoading.then(function () {
      return new Promise(function (resolve, reject) {
        slot.innerHTML = '';
        window.turnstile.render(slot, { sitekey: SITEKEY, callback: resolve, 'error-callback': function () { reject(new Error('spam check failed')); } });
      });
    });
  };

  /* ---------- send any form to /api/submit and report the reference number ---------- */
  TNY.submit = function (data, slot) {
    return TNY.spamToken(slot).then(function (token) {
      if (token) data.set('cf-turnstile-response', token);
      data.set('page', location.pathname);
      return fetch('/api/submit', { method: 'POST', body: data, headers: { Accept: 'application/json' } });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok || !body.ok) throw new Error(body.error || 'The message could not be sent.');
        return body;
      });
    });
  };

  var started = Date.now();
  $$('form.api-form').forEach(function (form) {
    var t0 = form.querySelector('input[name="t0"]'); if (t0) t0.value = String(started);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('.form-submit', form), status = $('.form-status', form), label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…'; status.className = 'form-status';
      TNY.submit(new FormData(form), $('.ts-slot', form)).then(function (body) {
        form.classList.add('sent'); form.reset();
        status.className = 'form-status ok show';
        status.innerHTML = '<h3>Received. Your reference is <span class="ref">' + E.escapeHtml(body.ref) + '</span></h3><p>A person will reply within one business day' +
          (body.confirmation ? ', and a confirmation is on its way to your inbox' : '') + '.' +
          (body.fileSaved === false ? ' Your file did not come through, so please email it to ' + EMAIL + ' with this reference.' : '') + '</p>';
        status.scrollIntoView({ block: 'center' });
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = label;
        status.className = 'form-status err show';
        status.innerHTML = '<h3>Not sent</h3><p>' + E.escapeHtml(err.message) + ' You can also email <a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.</p>';
      });
    });
  });
})();
