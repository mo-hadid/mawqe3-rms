/* NURA, the TECHNYAH website assistant.
   No AI model and no API calls: answers are matched in the browser against /assistant.json
   (built from content/kb.json and the service catalog), with site search as the fallback.
   Messages for the team go through /api/submit and come back with a reference number. */
(function () {
  'use strict';
  var TNY = window.TNY, E = TNY.Engine, KEY = 'tny-nura-1';
  var MIN_SCORE = 4, MIN_COVERAGE = 0.6;
  var EMAIL = document.documentElement.getAttribute('data-email') || 'info@technyah.com';

  var state = { log: [], flow: null, open: false };
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved && saved.log) state = saved; } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var FLOWS = {
    quote: { form: 'quote', intro: 'A few short questions, then I send it to the team. Type "cancel" at any time.', steps: [
      { key: 'message', ask: 'What do you need automated or fixed? One or two sentences is enough.' },
      { key: 'company', ask: 'Company name and city? (Type "skip" to leave it out.)', optional: true },
      { key: 'timeline', ask: 'When do you need it? For example: this week, or next quarter.', optional: true },
      { key: 'name', ask: 'Your name?' },
      { key: 'email', ask: 'Best email for the reply?', email: true }] },
    human: { form: 'ticket', intro: 'I will pass this to a person. Type "cancel" at any time.', steps: [
      { key: 'name', ask: 'Your name?' },
      { key: 'email', ask: 'Best email for the reply?', email: true },
      { key: 'message', ask: 'What would you like to ask or tell the team?' }] }
  };

  /* ---------- interface ---------- */
  var btn = document.createElement('button');
  btn.className = 'nura-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Open the NURA assistant');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z"/></svg>Ask NURA';
  var panel = document.createElement('div');
  panel.className = 'nura-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'NURA, the TECHNYAH assistant');
  panel.innerHTML = '<div class="nura-head"><img src="/images/brand/mark-white.svg" alt="" width="30" height="30"><div><strong>NURA</strong><span>TECHNYAH assistant</span></div>' +
    '<button type="button" class="nura-reset" aria-label="Start over" title="Start over">&#8635;</button><button type="button" class="nura-close" aria-label="Close">&times;</button></div>' +
    '<div class="nura-log" aria-live="polite"></div>' +
    '<div class="nura-quick"><button type="button" data-say="What services do you offer?">Services</button><button type="button" data-flow="quote">Get a quote</button>' +
    '<button type="button" data-say="My machine is down">Machine down</button><button type="button" data-flow="human">Talk to a person</button></div>' +
    '<form class="nura-input"><input type="text" placeholder="Type a question" aria-label="Your message" autocomplete="off" maxlength="600"><button type="submit">Send</button></form>' +
    '<p class="nura-foot">Answers come from TECHNYAH’s published information. Please do not share passwords.</p>';
  document.body.appendChild(btn); document.body.appendChild(panel);
  var log = panel.querySelector('.nura-log'), input = panel.querySelector('.nura-input input');

  function draw(m) {
    var el = document.createElement('div'); el.className = 'nura-msg ' + m.r; el.textContent = m.t; log.appendChild(el);
    if (m.links && m.links.length) {
      var row = document.createElement('div'); row.className = 'nura-links';
      m.links.forEach(function (l) {
        var a = document.createElement(l.flow ? 'button' : 'a'); a.textContent = l.t;
        if (l.flow) { a.type = 'button'; a.setAttribute('data-flow', l.flow); } else a.href = l.u;
        row.appendChild(a);
      });
      log.appendChild(row);
    }
    log.scrollTop = log.scrollHeight;
  }
  function say(r, t, links) { var m = { r: r, t: t, links: links || [] }; state.log.push(m); if (state.log.length > 60) state.log.shift(); save(); draw(m); }
  var bot = function (t, links) { say('bot', t, links); };

  function open() {
    panel.classList.add('open'); btn.style.display = 'none'; state.open = true; save(); log.scrollTop = log.scrollHeight;
    if (!state.log.length) bot('Hi, I’m NURA, TECHNYAH’s assistant. Ask me about services, pricing, the area we cover or careers, or I can pass a message to the team.');
    input.focus(); TNY.assistantData().catch(function () {});
  }
  function close() { panel.classList.remove('open'); btn.style.display = ''; state.open = false; save(); }
  btn.addEventListener('click', open);
  panel.querySelector('.nura-close').addEventListener('click', close);
  panel.querySelector('.nura-reset').addEventListener('click', function () { state.log = []; state.flow = null; log.innerHTML = ''; save(); open(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) close(); });
  state.log.forEach(draw);
  if (state.open) { panel.classList.add('open'); btn.style.display = 'none'; log.scrollTop = log.scrollHeight; }

  /* ---------- guided flows (quote request, message for a person) ---------- */
  function startFlow(name) {
    var f = FLOWS[name]; if (!f) return;
    state.flow = { name: name, i: 0, data: {} }; save();
    bot(f.intro + '\n\n' + f.steps[0].ask);
  }
  function flowStep(text) {
    var f = FLOWS[state.flow.name], step = f.steps[state.flow.i];
    if (/^(cancel|stop|never ?mind|quit|exit)$/i.test(text)) { state.flow = null; save(); return bot('Cancelled. Nothing was sent. What else can I help with?'); }
    if (step.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return bot('That does not look like an email address. Please type it again, or type "cancel".');
    if (!(step.optional && /^(skip|no|none|n\/a|-)$/i.test(text))) state.flow.data[step.key] = text;
    state.flow.i++; save();
    if (state.flow.i < f.steps.length) return bot(f.steps[state.flow.i].ask);
    send(f.form, state.flow.data); state.flow = null; save();
  }
  function send(form, d) {
    var data = new FormData();
    data.set('form', form); data.set('source', 'assistant'); data.set('t0', '0');
    ['name', 'email', 'company', 'timeline', 'message'].forEach(function (k) { if (d[k]) data.set(k, d[k]); });
    data.set('subject', form === 'quote' ? 'Quote request from the assistant' : 'Message from the assistant');
    data.set('transcript', state.log.slice(-24).map(function (m) { return (m.r === 'user' ? 'Visitor: ' : m.r === 'bot' ? 'NURA: ' : '') + m.t; }).join('\n').slice(0, 6000));
    var slot = document.createElement('div'); log.appendChild(slot);
    say('sys', 'Sending…');
    TNY.submit(data, slot).then(function (body) {
      say('sys', 'Reference ' + body.ref);
      bot('Sent, ' + (d.name || 'thank you') + '. Your reference is ' + body.ref + '. A person will reply to ' + d.email + ' within one business day. Anything else?');
    }).catch(function () {
      var body = encodeURIComponent((d.message || '') + '\n\n' + (d.name || '') + '\n' + (d.company || ''));
      bot('I could not send that just now. Please email it instead and we will pick it up.', [{ t: 'Email ' + EMAIL, u: 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Website request') + '&body=' + body }]);
    });
  }

  /* ---------- answering ---------- */
  var kbIndex;
  function knowledge() {
    return TNY.assistantData().then(function (d) {
      return kbIndex || (kbIndex = new E.Index(d.entries.map(function (e) { return { t: e.q.join(' . '), kw: e.kw, x: e.a, entry: e }; })));
    });
  }
  function respond(text) {
    if (state.flow) return flowStep(text);
    var hello = /^(hi|hello|hey|good (morning|afternoon|evening)|salam|assalamu?)\b/i.exec(text);
    if (hello && E.tokenize(text.slice(hello[0].length)).length < 3) return bot('Hello. What can I help you with?');
    if (/^(thanks|thank you|thx|ty|great|perfect|ok(ay)?)\b[\s!.,]*$/i.test(text)) return bot('You’re welcome. Anything else?');
    if (/^(bye|goodbye|that'?s all|no thanks?|nothing else)\b/i.test(text)) return bot('Thanks for stopping by. The team is at ' + EMAIL + ' whenever you need them.');
    if (/\b(human|real person|live agent|representative|call me|speak (to|with)|talk (to|with) (a|an|some))/i.test(text)) return startFlow('human');
    knowledge().then(function (idx) {
      var res = idx.search(text, { limit: 3 }), top = res[0];
      // questions about money, timing or "what do you do" always get the direct answer, plus the closest service link
      var direct = /\b(how much|cost|costs|price|prices|pricing|rates?|charge|expensive|budget)\b/i.test(text) ? 'pricing'
        : /\b(how long|lead ?time|how soon|turnaround)\b/i.test(text) ? 'timeline'
        : !E.tokenize(text).length ? 'what-we-do' : null;
      if (direct) {
        var entry = idx.docs.filter(function (d) { return d.entry.id === direct; })[0].entry, dl = entry.links.slice();
        var svc = res.filter(function (r) { return /^svc-/.test(r.doc.entry.id) && r.score >= MIN_SCORE; })[0];
        if (svc && svc.doc.entry.links[0].u) dl.unshift(svc.doc.entry.links[0]);
        return bot(entry.a, dl);
      }
      if (top && top.score >= MIN_SCORE && top.coverage >= MIN_COVERAGE) {
        var links = (top.doc.entry.links || []).slice();
        var next = res[1];
        if (next && next.score >= top.score * 0.8 && next.doc.entry.links) {
          var extra = next.doc.entry.links.filter(function (l) { return l.u && !links.some(function (k) { return k.u === l.u; }); })[0];
          if (extra) links.push(extra);
        }
        return bot(top.doc.entry.a, links);
      }
      return TNY.searchIndex().then(function (site) {
        var found = site.search(text, { limit: 3 }), seen = {}, pages = [], many = E.tokenize(text).length > 1;
        found.forEach(function (r) { if (r.score < 2.5 || (many && r.coverage <= 0.5)) return; var u = r.doc.u.split('#')[0]; if (!seen[u]) { seen[u] = 1; pages.push({ t: r.doc.t.split(' | ')[0], u: r.doc.u }); } });
        if (pages.length) bot('I do not have a prepared answer for that. These pages look closest:', pages.concat([{ t: 'Ask the team', flow: 'human' }]));
        else bot('I could not find that on the site. I can pass your question to a person, who will reply within one business day.', [{ t: 'Ask the team', flow: 'human' }, { t: 'Contact page', u: '/contact/' }]);
      });
    }).catch(function () {
      bot('I am having trouble loading my answers. You can reach the team directly.', [{ t: 'Contact page', u: '/contact/' }, { t: 'Email ' + EMAIL, u: 'mailto:' + EMAIL }]);
    });
  }

  panel.querySelector('.nura-input').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim(); if (!text) return;
    input.value = ''; say('user', text); respond(text);
  });
  panel.addEventListener('click', function (e) {
    var t = e.target.closest('[data-flow],[data-say]'); if (!t) return;
    if (t.hasAttribute('data-flow')) { if (!state.flow) startFlow(t.getAttribute('data-flow')); }
    else { var q = t.getAttribute('data-say'); say('user', q); respond(q); }
    input.focus();
  });
})();
