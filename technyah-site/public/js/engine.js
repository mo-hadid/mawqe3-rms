/* TECHNYAH search engine. Runs entirely in the browser: no server, no API, no tokens.
   Ranked full-text search (BM25) with stemming, synonyms, prefix and typo matching.
   Used by the header search, the /search/ page and the NURA assistant. */
(function (root) {
  'use strict';

  var STOP = {};
  ('a an and are as at be been but by can could did do does for from had has have how i if in into is it its ' +
   'me my of on or our so some that the their them then there these they this to up us was we were what when ' +
   'where which who why will with would you your about any also just need want like get got please tell know').split(' ')
    .forEach(function (w) { STOP[w] = 1; });

  // Words visitors use interchangeably. Each group is matched as one idea.
  var GROUPS = [
    ['robot', 'robotic', 'cobot', 'arm', 'manipulator'],
    ['plc', 'controller', 'logic', 'ladder'],
    ['hmi', 'touchscreen', 'screen', 'scada'],
    ['vfd', 'drive', 'inverter', 'servo'],
    ['conveyor', 'belt', 'sortation', 'roller'],
    ['price', 'cost', 'pricing', 'quote', 'estimate', 'rate', 'budget', 'much'],
    ['job', 'career', 'hiring', 'position', 'employment', 'internship', 'intern', 'vacancy', 'apply', 'resume'],
    ['fix', 'repair', 'troubleshoot', 'broken', 'fault', 'breakdown', 'stopped', 'down', 'downtime', 'emergency'],
    ['vision', 'camera', 'inspection', 'inspect'],
    ['train', 'training', 'course', 'class', 'teach'],
    ['contact', 'reach', 'call', 'email', 'phone', 'talk', 'speak'],
    ['location', 'located', 'address', 'based', 'area', 'near', 'office'],
    ['upgrade', 'retrofit', 'migration', 'migrate', 'modernize', 'replace', 'obsolete', 'legacy'],
    ['data', 'dashboard', 'oee', 'monitoring', 'iiot', 'reporting'],
    ['network', 'ethernet', 'communication', 'modbus', 'profinet'],
    ['machine', 'equipment', 'machinery'],
    ['custom', 'bespoke', 'special', 'fixture'],
    ['fast', 'quick', 'soon', 'turnaround', 'response', 'long', 'time'],
    ['food', 'beverage', 'bottling', 'juice', 'citrus'],
    ['warehouse', 'distribution', 'logistics', 'fulfillment'],
    ['package', 'packaging', 'palletize', 'palletizing', 'cartoner', 'labeler'],
    ['drone', 'uav', 'aerial']
  ];

  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + 'y';
    else if (w.length > 4 && /(x|ch|sh|z)es$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 5 && /sses$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
    if (w.length > 6 && /[ts]ion$/.test(w)) w = w.slice(0, -3);
    var cut = null;
    if (w.length > 5 && /ing$/.test(w)) cut = w.slice(0, -3);
    else if (w.length > 4 && /ed$/.test(w)) cut = w.slice(0, -2);
    else if (w.length > 6 && /er$/.test(w)) cut = w.slice(0, -2);
    if (cut) { w = /(.)\1$/.test(cut) && !/(ll|ss|zz)$/.test(cut) ? cut.slice(0, -1) : cut; }
    if (w.length > 4 && /e$/.test(w)) w = w.slice(0, -1);
    return w;
  }

  function words(text) {
    return String(text || '').toLowerCase().replace(/&amp;/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  }
  function tokenize(text, keepStop) {
    var out = [];
    words(text).forEach(function (w) { if ((keepStop || !STOP[w]) && (w.length > 1 || /\d/.test(w))) out.push(stem(w)); });
    return out;
  }

  var SYN = {};
  GROUPS.forEach(function (g) {
    var stems = g.map(stem);
    stems.forEach(function (s) { SYN[s] = (SYN[s] || []).concat(stems.filter(function (o) { return o !== s; })); });
  });

  // Damerau-Levenshtein distance, capped (returns max+1 when over)
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev2 = null, prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var best = cur[0];
      for (j = 1; j <= b.length; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }

  var FIELD_WEIGHT = { t: 3, h: 2.2, kw: 2.6, x: 1 };

  /* docs: [{ t: title, h: heading, kw: keywords, x: body text, ...anything }] */
  function Index(docs) {
    var self = this;
    this.docs = docs; this.df = {}; this.tf = []; this.len = []; this.avg = 0;
    docs.forEach(function (d, i) {
      var tf = {}, len = 0;
      Object.keys(FIELD_WEIGHT).forEach(function (f) {
        tokenize(Array.isArray(d[f]) ? d[f].join(' ') : d[f]).forEach(function (tok) {
          tf[tok] = (tf[tok] || 0) + FIELD_WEIGHT[f]; len += FIELD_WEIGHT[f];
        });
      });
      self.tf[i] = tf; self.len[i] = len; self.avg += len;
      Object.keys(tf).forEach(function (tok) { self.df[tok] = (self.df[tok] || 0) + 1; });
    });
    this.avg = this.avg / (docs.length || 1);
    this.vocab = Object.keys(this.df);
  }

  Index.prototype.candidates = function (tok, allowPrefix) {
    var self = this, out = [], seen = {};
    function add(term, w) { if (self.df[term] && !(seen[term] >= w)) { seen[term] = w; out.push([term, w]); } }
    add(tok, 1);
    (SYN[tok] || []).forEach(function (s) { add(s, 0.55); });
    if ((allowPrefix || !this.df[tok]) && tok.length >= 3) {
      var n = 0;
      for (var i = 0; i < this.vocab.length && n < 8; i++) {
        var v = this.vocab[i];
        if (v.length > tok.length && v.indexOf(tok) === 0) { add(v, this.df[tok] ? 0.5 : 0.75); n++; }
      }
    }
    if (!out.length && tok.length >= 4 && !/^\d+$/.test(tok)) {
      var max = tok.length >= 8 ? 2 : 1, found = [];
      this.vocab.forEach(function (v) {
        if (v.charAt(0) !== tok.charAt(0)) return;
        var d = editDistance(tok, v, max);
        if (d <= max) found.push([v, d]);
      });
      found.sort(function (a, b) { return a[1] - b[1]; }).slice(0, 4).forEach(function (f) {
        add(f[0], f[1] === 1 ? 0.6 : 0.4);
        (SYN[f[0]] || []).forEach(function (s) { add(s, 0.3); });
      });
    }
    return out;
  };

  /* opts: { limit, prefixLast, filter(doc), boost(doc) } → [{ doc, score, coverage, terms }] */
  Index.prototype.search = function (query, opts) {
    opts = opts || {};
    var self = this, q = tokenize(query);
    if (!q.length) q = tokenize(query, true);
    if (!q.length) return [];
    var N = this.docs.length, k1 = 1.4, b = 0.7, scores = {}, hits = {}, terms = {};
    q.forEach(function (tok, qi) {
      var cands = self.candidates(tok, opts.prefixLast && qi === q.length - 1), best = {};
      cands.forEach(function (c) {
        var term = c[0], w = c[1], idf = Math.log(1 + (N - self.df[term] + 0.5) / (self.df[term] + 0.5));
        for (var i = 0; i < N; i++) {
          var f = self.tf[i][term]; if (!f) continue;
          var s = w * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * self.len[i] / self.avg));
          if (!(best[i] >= s)) { best[i] = s; (terms[i] = terms[i] || {})[term] = 1; }
        }
      });
      Object.keys(best).forEach(function (i) { scores[i] = (scores[i] || 0) + best[i]; hits[i] = (hits[i] || 0) + 1; });
    });
    var need = q.length > 3 ? Math.ceil(q.length / 2) : 1, out = [];
    Object.keys(scores).forEach(function (i) {
      if (hits[i] < need) return;
      var doc = self.docs[i]; if (opts.filter && !opts.filter(doc)) return;
      var cov = hits[i] / q.length;
      out.push({ doc: doc, score: scores[i] * (0.35 + 0.65 * cov * cov) * (opts.boost ? opts.boost(doc) : 1), coverage: cov, terms: Object.keys(terms[i] || {}) });
    });
    out.sort(function (a, b2) { return b2.score - a.score; });
    return out.slice(0, opts.limit || 10);
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; });
  }
  /* A short excerpt around the first matching word, with matches wrapped in <mark>. Returns safe HTML. */
  function snippet(text, terms, size) {
    text = String(text || ''); size = size || 170;
    var set = {}; (terms || []).forEach(function (t) { set[t] = 1; });
    var re = /[A-Za-z0-9]+/g, m, first = -1;
    while ((m = re.exec(text))) { if (set[stem(m[0].toLowerCase())]) { first = m.index; break; } }
    var start = Math.max(0, (first < 0 ? 0 : first) - 60);
    if (start > 0) { var sp = text.indexOf(' ', start); if (sp > -1 && sp < start + 25) start = sp + 1; }
    var cut = text.slice(start, start + size), html = '', last = 0;
    re = /[A-Za-z0-9]+/g;
    while ((m = re.exec(cut))) {
      if (set[stem(m[0].toLowerCase())]) { html += escapeHtml(cut.slice(last, m.index)) + '<mark>' + escapeHtml(m[0]) + '</mark>'; last = m.index + m[0].length; }
    }
    html += escapeHtml(cut.slice(last));
    return (start > 0 ? '… ' : '') + html + (start + size < text.length ? ' …' : '');
  }

  var api = { Index: Index, tokenize: tokenize, stem: stem, snippet: snippet, escapeHtml: escapeHtml, editDistance: editDistance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TNY = root.TNY || {}; root.TNY.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
