#!/usr/bin/env node
/* TECHNYAH site build. No dependencies: `node build.mjs` turns content/ + public/ into dist/.
   Edit the JSON files in content/ to change services, industries, products, jobs and assistant answers. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');
const PUB = path.join(ROOT, 'public');
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));
const site = J('site.json'), services = J('services.json'), industries = J('industries.json'),
  products = J('products.json'), jobs = J('jobs.json'), photos = J('photos.json'), kb = J('kb.json');
delete photos._readme;

const YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const slugify = s => String(s).toLowerCase().replace(/&amp;|&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const has = rel => fs.existsSync(path.join(PUB, rel));
const svc = slug => services.find(s => s.slug === slug);
const strip = html => html.replace(/<(script|style|form|nav)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&rarr;/g, '').replace(/&mdash;/g, '-')
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

// cache-busting version from the assets that change
const VER = crypto.createHash('sha1').update(['css/styles.css', 'js/engine.js', 'js/main.js', 'js/nura.js']
  .map(f => fs.readFileSync(path.join(PUB, f))).join('') + JSON.stringify([services, industries, jobs, kb, products])).digest('hex').slice(0, 8);

/* ---------- pictures: a real photo when it has been downloaded, the illustration until then ---------- */
function media(key, { eager = false, cls = '' } = {}) {
  const p = photos[key];
  if (!p) return '';
  if (has(`images/photos/${key}.jpg`))
    return `<img class="photo ${cls}" src="/images/photos/${key}.jpg" alt="${esc(p.alt)}" width="1600" height="1067" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
  return `<div class="photo-fallback ${cls}" aria-hidden="true"><img src="/images/graphics/${p.fallback}.svg" alt="" loading="lazy"></div>`;
}
const svgSize = (rel, h) => { const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(fs.readFileSync(path.join(PUB, rel), 'utf8')); return m ? `width="${Math.round(h * m[1] / m[2])}" height="${h}"` : ''; };

/* ---------- structured data ---------- */
const ORG_ID = site.url + '/#organization';
const org = {
  '@type': 'ProfessionalService', '@id': ORG_ID, name: site.name, legalName: site.legalName, url: site.url + '/',
  logo: site.url + '/images/brand/favicon-512.png', image: site.url + '/images/brand/og-image.png',
  description: site.description, email: site.email, slogan: site.tagline,
  ...(site.phone ? { telephone: site.phone } : {}),
  address: { '@type': 'PostalAddress', ...(site.streetAddress ? { streetAddress: site.streetAddress } : {}), addressLocality: site.locality,
    addressRegion: site.region, ...(site.postalCode ? { postalCode: site.postalCode } : {}), addressCountry: site.country },
  areaServed: site.areaServed.map(n => ({ '@type': n === site.regionName ? 'State' : /County/.test(n) ? 'AdministrativeArea' : 'City', name: n })),
  knowsAbout: services.map(s => s.title),
  ...(site.linkedin ? { sameAs: [site.linkedin] } : {}),
};
const faqSchema = faqs => ({ '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
const crumbSchema = crumbs => ({ '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: site.url + c.url })) });

/* ---------- page shell ---------- */
const pages = [];      // { url, lastmod, index }
const searchDocs = []; // search-index.json

function layout({ url, title, description, body, schema = [], crumbs = null, noindex = false }) {
  const fullTitle = /TECHNYAH/i.test(title) ? title : `${title} | TECHNYAH`;
  const canonical = site.url + url;
  const graph = [...schema, ...(crumbs ? [crumbSchema(crumbs)] : [])];
  const nav = site.nav.map(n => `<li><a href="${n.href}"${url.startsWith(n.href) ? ' class="active" aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('');
  return `<!DOCTYPE html>
<html lang="en" data-turnstile="${esc(site.turnstileSiteKey)}" data-email="${esc(site.email)}" data-v="${VER}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${noindex ? '<meta name="robots" content="noindex, follow">\n' : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site.url}/images/brand/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E1B25">
<link rel="icon" type="image/svg+xml" href="/images/brand/mark.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/brand/favicon-32.png">
<link rel="apple-touch-icon" href="/images/brand/apple-touch-icon.png">
<link rel="preload" href="/fonts/barlow-condensed-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/barlow-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/styles.css?v=${VER}">
${graph.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>\n` : ''}</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="header-inner">
    <a href="/" class="brand" aria-label="TECHNYAH home"><img src="/images/brand/logo-compact-white.svg" alt="TECHNYAH" ${svgSize('images/brand/logo-compact-white.svg', 40)}></a>
    <button class="hamburger-menu" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">&#9776;</button>
    <ul class="nav-links" id="site-nav">${nav}</ul>
    <form class="header-search" action="/search/" method="get" role="search">
      <input type="search" name="q" class="search-bar" placeholder="Search&hellip;" aria-label="Search the site" autocomplete="off">
      <div class="suggestions-dropdown"></div>
    </form>
    <a class="nav-cta" href="/quote/">Get a quote</a>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <img src="/images/brand/logo-white.svg" alt="TECHNYAH: automation, robotics, controls" ${svgSize('images/brand/logo-white.svg', 50)} loading="lazy">
      <p>${esc(site.legalName)}<br>${esc(site.locality)}, ${esc(site.regionName)}</p>
      <p class="footer-scope">${esc(site.scopeNote)}</p>
    </div>
    <div>
      <h3>Services</h3>
      <ul>${services.map(s => `<li><a href="/services/${s.slug}/">${esc(s.title)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h3>Company</h3>
      <ul><li><a href="/about/">About</a></li><li><a href="/industries/">Industries</a></li><li><a href="/products/">Products</a></li><li><a href="/careers/">Careers</a></li><li><a href="/faq/">Questions</a></li><li><a href="/privacy/">Privacy</a></li></ul>
    </div>
    <div>
      <h3>Work with us</h3>
      <ul><li><a href="/quote/">Request a quote</a></li><li><a href="/contact/">Contact</a></li><li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>${site.linkedin ? `<li><a href="${esc(site.linkedin)}" rel="noopener">LinkedIn</a></li>` : ''}</ul>
    </div>
  </div>
  <div class="footer-bottom"><p>&copy; ${YEAR} ${esc(site.legalName)}. All rights reserved.</p></div>
</footer>
<script src="/js/engine.js?v=${VER}" defer></script>
<script src="/js/main.js?v=${VER}" defer></script>
<script src="/js/nura.js?v=${VER}" defer></script>
</body>
</html>
`;
}

/* give every h2 an id so search results and the assistant can link to a section */
function withHeadingIds(html) {
  const used = {};
  return html.replace(/<h2(?![^>]*\sid=)([^>]*)>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
    let id = slugify(strip(inner)) || 'section'; used[id] = (used[id] || 0) + 1; if (used[id] > 1) id += '-' + used[id];
    return `<h2 id="${id}"${attrs}>${inner}</h2>`;
  });
}

function emit(url, opts, { kind = 'Page', keywords = [], index = true, search = true } = {}) {
  opts.body = withHeadingIds(opts.body);
  const file = url.endsWith('/') ? path.join(OUT, url, 'index.html') : path.join(OUT, url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, layout({ url, ...opts }));
  if (index && !opts.noindex) pages.push({ url, lastmod: TODAY });
  if (search && !opts.noindex) {
    opts.body.replace(/<section class="cta-band">[\s\S]*?<\/section>|<ol class="breadcrumbs">[\s\S]*?<\/ol>|<p class="(eyebrow|kicker)">[\s\S]*?<\/p>|<h1>[\s\S]*?<\/h1>/g, ' ').split(/(?=<h2[\s>])/).forEach((chunk, i) => {
      const hm = /<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/.exec(chunk);
      const text = strip(hm ? chunk.replace(hm[0], '') : chunk);
      if (text.length < 40) return;
      searchDocs.push({ u: url + (hm ? '#' + hm[1] : ''), t: opts.title, h: hm ? strip(hm[2]) : '', x: text.slice(0, 700), k: kind, ...(i === 0 ? { kw: keywords } : {}) });
    });
  }
}

/* ---------- shared fragments ---------- */
const pageHero = (eyebrow, h1, lead, crumbs) => `<section class="page-hero"><div class="hero-grid"></div><div class="container">
${crumbs ? `<ol class="breadcrumbs">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<li><a href="${c.url}">${esc(c.name)}</a></li>` : `<li aria-current="page">${esc(c.name)}</li>`).join('')}</ol>` : ''}
<p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(h1)}</h1>${lead ? `<p>${esc(lead)}</p>` : ''}</div></section>`;

const ctaBand = (h, p, a = ['/quote/', 'Request a quote'], b = ['/contact/', 'Ask a question']) => `<section class="cta-band"><div class="container">
<div><h2>${esc(h)}</h2><p>${esc(p)}</p></div>
<div class="hero-actions"><a href="${a[0]}" class="cta-btn">${esc(a[1])}</a><a href="${b[0]}" class="btn-outline">${esc(b[1])}</a></div></div></section>`;

const serviceTile = s => `<a class="tile" href="/services/${s.slug}/">${media(s.photo)}<div class="tile-body"><p class="spec-label">${esc(s.label)}</p><h3>${esc(s.title)}</h3><p>${esc(s.short)}</p><span class="tile-more">Details &rarr;</span></div></a>`;
const serviceIconTile = s => `<a class="tile icon-tile" href="/services/${s.slug}/"><img src="/images/graphics/${s.icon}.svg" alt="" width="64" height="48" loading="lazy"><div class="tile-body"><h3>${esc(s.title)}</h3><p>${esc(s.short)}</p></div></a>`;
const industryTile = i => `<a class="tile" href="/industries/${i.slug}/">${media(i.photo)}<div class="tile-body"><h3>${esc(i.title)}</h3><p>${esc(i.short)}</p><span class="tile-more">How we help &rarr;</span></div></a>`;
const faqBlock = faqs => `<div class="faq">${faqs.map(f => `<details${f.id ? ` id="${f.id}"` : ''}><summary>${esc(f.q)}</summary><div><p>${esc(f.a)}${f.more ? ` <a href="${f.more[1]}">${esc(f.more[0])}</a>` : ''}</p></div></details>`).join('')}</div>`;

/* one form shell for every form on the site; functions/api/submit.js receives it */
function apiForm(kind, fields, button, note, extra = '') {
  return `<form class="api-form form-shell${extra ? ' ' + extra : ''}" data-form="${kind}" action="/api/submit" method="post" enctype="multipart/form-data">
<input type="hidden" name="form" value="${kind}"><input type="hidden" name="t0" value="">
<div class="hp-field" aria-hidden="true"><label>Leave this field empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<div class="form-grid">${fields}</div>
<div class="ts-slot"></div>
<button type="submit" class="form-submit">${esc(button)}</button>
<p class="form-note" style="margin-top:12px;text-align:center">${note}</p>
<div class="form-status" role="status" aria-live="polite"></div>
</form>`;
}
const field = (id, label, input, { full = false, hint = '' } = {}) => `<div class="form-field${full ? ' full' : ''}"><label for="${id}">${label}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const FILES_ANY = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg,.dxf,.step,.stp,.zip';

/* =====================================================================
   HOME
   ===================================================================== */
const heroMedia = has('images/photos/robot-cell.jpg') ? media('robot-cell', { eager: true })
  : `<img class="hero-illustration" src="/images/graphics/hero-line.svg" alt="Illustration of a robot loading a conveyor while a camera inspects each part" width="480" height="360">`;
emit('/', {
  title: 'TECHNYAH | Industrial Automation, Robotics & Controls in Lakeland, Florida',
  description: site.description,
  schema: [org, { '@type': 'WebSite', '@id': site.url + '/#website', url: site.url + '/', name: site.name, publisher: { '@id': ORG_ID } }, faqSchema(site.homeFaqs)],
  body: `<section class="hero-section"><div class="hero-grid"></div>
<div class="hero-content">
  <div>
    <p class="kicker">Transforming automation, redefining possibilities</p>
    <h1>Automation, robotics and controls for Florida manufacturers</h1>
    <p class="hero-sub">We program, integrate and repair the equipment that runs your line: robots, PLCs, conveyors, vision and custom machines. Based in ${esc(site.locality)}, working across Polk County, Tampa Bay and Orlando.</p>
    <div class="hero-actions"><a href="/quote/" class="cta-btn">Request a quote</a><a href="/services/" class="btn-outline">See our services</a></div>
    <ul class="hero-points"><li>Reply within ${esc(site.responseTime)}</li><li>Machines we did not build are welcome</li><li>You keep the source code</li></ul>
  </div>
  <div class="hero-media">${heroMedia}</div>
</div></section>

<section class="trust-strip"><div class="container grid-3">
  <div class="trust-item"><h3><span class="tick">&#10003;</span>Hands-on from first test to handover</h3><p>The people who scope your job are the people who program it, commission it and answer the phone afterward.</p></div>
  <div class="trust-item"><h3><span class="tick">&#10003;</span>Built to recognized standards</h3><p>Machine safety, electrical and robot standards guide every design, and each robot application gets a documented risk assessment.</p></div>
  <div class="trust-item"><h3><span class="tick">&#10003;</span>One schedule, the right licenses</h3><p>We bring in licensed electrical contractors and certified panel shops where the work calls for them, under one plan.</p></div>
</div></section>

<section class="section"><div class="container">
  <div class="section-head"><p class="eyebrow">What we do</p><h2>Automation services</h2><p>Eight services that cover a production line from a single stubborn fault to a new robot cell.</p></div>
  <div class="grid-2">${services.map(serviceIconTile).join('')}</div>
</div></section>

<section class="section alt"><div class="container">
  <div class="section-head"><p class="eyebrow">Who we work for</p><h2>Industries across Central Florida</h2><p>Polk County sits between Tampa and Orlando with one of the densest clusters of food, packaging, building-product and distribution operations in the state.</p></div>
  <div class="grid-3">${industries.map(industryTile).join('')}</div>
</div></section>

<section class="section"><div class="container">
  <div class="section-head"><p class="eyebrow">How a job runs</p><h2>Four steps, in writing</h2></div>
  <ol class="steps">
    <li><h3>See the machine</h3><p>A site visit or photos, the controller model, the fault history and whatever drawings exist.</p></li>
    <li><h3>Agree the scope</h3><p>A written scope with what is included, what you provide, a dated plan and a fixed price or hourly rate.</p></li>
    <li><h3>Build and test</h3><p>Programs are tested before they reach your floor, so start-up time is spent proving the machine, not debugging it.</p></li>
    <li><h3>Commission and hand over</h3><p>We prove the acceptance test with your team, train operators and hand over source files, backups and records.</p></li>
  </ol>
</div></section>

<section class="section alt"><div class="container">
  <div class="section-head"><p class="eyebrow">Service area</p><h2>Lakeland, Polk County and the I-4 corridor</h2><p>${esc(site.homeFaqs[1].a)}</p></div>
  <ul class="chips">${site.areaServed.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
</div></section>

<section class="section"><div class="container" style="max-width:860px">
  <div class="section-head"><p class="eyebrow">Common questions</p><h2>Before you call</h2></div>
  ${faqBlock(site.homeFaqs)}
  <p style="margin-top:18px"><a href="/faq/">More questions and answers &rarr;</a></p>
</div></section>

${ctaBand('Which machine costs you the most downtime?', 'Tell us about it. You get a reference number at once and a reply from a person within one business day.')}`,
}, { keywords: ['automation', 'robotics', 'controls', 'integrator', 'Lakeland', 'Polk County', 'Florida', 'manufacturing'] });

/* =====================================================================
   SERVICES
   ===================================================================== */
const sCrumb = [{ name: 'Home', url: '/' }, { name: 'Services', url: '/services/' }];
emit('/services/', {
  title: 'Industrial Automation Services in Lakeland & Central Florida',
  description: 'Robot integration, PLC and HMI programming, conveyor controls, machine vision, custom machines, troubleshooting, industrial networks and training for Florida manufacturers.',
  crumbs: sCrumb,
  schema: [{ '@type': 'ItemList', itemListElement: services.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site.url}/services/${s.slug}/`, name: s.title })) }],
  body: `${pageHero('Services', 'Automation services for production equipment', 'From one stubborn fault to a complete robot cell. Each service comes with a written scope, a tested program and a clean handover.', sCrumb)}
<section class="section"><div class="container">
  <div class="page-search"><label for="service-search" class="form-note" style="display:block;margin-bottom:6px">Filter services</label>
    <input type="search" id="service-search" class="page-filter" data-target="#service-list > .tile" placeholder="Try: conveyor, PLC, robot, vision, training" aria-label="Filter services"></div>
  <p class="no-results">No service matches that word. <a href="/quote/">Describe your project</a> and we will tell you whether we can help.</p>
  <div class="grid-3" id="service-list">${services.map(serviceTile).join('')}</div>
  <p class="note" style="margin-top:32px">${esc(site.scopeNote)} ${esc(site.notOffered)}</p>
</div></section>
${ctaBand('Not sure which service you need?', 'Describe the problem in your own words and we will point you to the right starting point.')}`,
}, { kind: 'Page', keywords: ['services'] });

for (const s of services) {
  const url = `/services/${s.slug}/`, crumbs = [...sCrumb, { name: s.title, url }];
  emit(url, {
    title: s.seoTitle, description: s.seoDescription, crumbs,
    schema: [{ '@type': 'Service', '@id': site.url + url + '#service', name: s.title, serviceType: s.title, description: s.seoDescription, url: site.url + url,
      provider: { '@id': ORG_ID }, areaServed: org.areaServed }, org, faqSchema(s.faqs)],
    body: `${pageHero(s.label, s.title, s.short, crumbs)}
<section class="section"><div class="container detail-grid">
  <div class="detail-main">
    ${media(s.photo, { eager: true })}
    ${s.intro.map(p => `<p>${esc(p)}</p>`).join('')}
    <h2>What we do</h2>
    <ul class="check-list">${s.scope.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2>What you get</h2>
    <ul class="check-list">${s.outcomes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2>Questions about ${esc(s.title.toLowerCase())}</h2>
    ${faqBlock(s.faqs)}
  </div>
  <aside class="detail-side">
    <div class="side-card dark"><h3>Start with a conversation</h3><p>Send the model numbers and a few photos. You get a reference number at once and a reply within ${esc(site.responseTime)}.</p><a href="/quote/?service=${s.slug}" class="cta-btn">Request a quote</a></div>
    <div class="side-card"><h4>Related services</h4><ul class="side-links">${s.related.map(r => svc(r)).filter(Boolean).map(r => `<li><a href="/services/${r.slug}/">${esc(r.title)}</a></li>`).join('')}</ul></div>
    <div class="side-card"><h4>Where we work</h4><p class="muted" style="margin:0">${esc(site.locality)}, Polk County, Tampa Bay and Orlando. Elsewhere in Florida by project.</p></div>
  </aside>
</div></section>
${ctaBand(`Need help with ${s.title.toLowerCase()}?`, 'Tell us what the machine does today and what you want it to do.', [`/quote/?service=${s.slug}`, 'Request a quote'])}`,
  }, { kind: 'Service', keywords: s.keywords });
}

/* =====================================================================
   INDUSTRIES
   ===================================================================== */
const iCrumb = [{ name: 'Home', url: '/' }, { name: 'Industries', url: '/industries/' }];
emit('/industries/', {
  title: 'Industries We Automate in Polk County & Central Florida',
  description: 'Automation and controls for food and beverage, packaging, distribution, metal fabrication, building products, medical device and agricultural operations in Central Florida.',
  crumbs: iCrumb,
  body: `${pageHero('Industries', 'Built around how your plant runs', 'Different plants stop for different reasons. These are the operations we know best and the problems we are usually called for.', iCrumb)}
<section class="section"><div class="container"><div class="grid-3">${industries.map(industryTile).join('')}</div>
<p class="note" style="margin-top:32px">${esc(site.notOffered)}</p></div></section>
${ctaBand('Your industry is not listed?', 'If it has motors, sensors and a controller, we can probably help. Ask us.')}`,
}, { keywords: ['industries', 'manufacturers'] });

for (const i of industries) {
  const url = `/industries/${i.slug}/`, crumbs = [...iCrumb, { name: i.title, url }];
  emit(url, {
    title: i.seoTitle, description: i.seoDescription, crumbs, schema: [org],
    body: `${pageHero('Industry', i.title, i.short, crumbs)}
<section class="section"><div class="container detail-grid">
  <div class="detail-main">
    ${media(i.photo, { eager: true })}
    <p>${esc(i.intro)}</p>
    <h2>What plants like yours call us for</h2>
    <ul class="check-list">${i.needs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2>Services that fit</h2>
    <div class="grid-2">${i.services.map(svc).filter(Boolean).map(serviceIconTile).join('')}</div>
  </div>
  <aside class="detail-side">
    <div class="side-card dark"><h3>Talk through your line</h3><p>Tell us where it stops most often. You get a reply from a person within ${esc(site.responseTime)}.</p><a href="/quote/" class="cta-btn">Request a quote</a></div>
    <div class="side-card"><h4>Other industries</h4><ul class="side-links">${industries.filter(o => o.slug !== i.slug).map(o => `<li><a href="/industries/${o.slug}/">${esc(o.title)}</a></li>`).join('')}</ul></div>
  </aside>
</div></section>
${ctaBand('Which machine costs you the most downtime?', 'Start there. A short conversation usually shows the cheapest fix first.')}`,
  }, { kind: 'Industry', keywords: i.keywords });
}

/* =====================================================================
   PRODUCTS
   ===================================================================== */
const pCrumb = [{ name: 'Home', url: '/' }, { name: 'Products', url: '/products/' }];
emit('/products/', {
  title: 'Products: Aerial Monitoring & Motion Controllers',
  description: 'TECHNYAH products in development: the DSS-2 aerial monitoring system and the ST-2500 flight and motion controller.',
  crumbs: pCrumb,
  body: `${pageHero('Products', 'Hardware we are developing', 'Designed in-house and supported by the same team. Ask to be told when each product is available.', pCrumb)}
<section class="section"><div class="container">
  <div class="page-search"><label for="product-search" class="form-note" style="display:block;margin-bottom:6px">Filter products</label>
    <input type="search" id="product-search" class="page-filter" data-target="#product-list > .tile" placeholder="Try: aerial, controller" aria-label="Filter products"></div>
  <p class="no-results">No product matches that word. Need something purpose-built? <a href="/contact/">Talk to us</a>.</p>
  <div class="grid-2" id="product-list">${products.map(p => `<article class="tile" id="${slugify(p.id)}"><div class="photo-fallback" aria-hidden="true"><img src="/images/graphics/${p.graphic}.svg" alt="" loading="lazy"></div>
    <div class="tile-body"><p><span class="badge">${esc(p.status)}</span></p><h3>${esc(p.name)}</h3><p>${esc(p.short)}</p><p class="visually-hidden">${esc(p.keywords.join(', '))}</p>
    <a class="tile-more" href="/contact/?topic=Product&amp;subject=${encodeURIComponent(p.name)}">Ask about availability &rarr;</a></div></article>`).join('')}</div>
</div></section>
${ctaBand('Need hardware built for one job?', 'Custom fixtures, controllers and machines are part of our project work.', ['/services/custom-machines/', 'Custom machines'], ['/contact/', 'Talk to us'])}`,
}, { kind: 'Product', keywords: products.flatMap(p => p.keywords) });

/* =====================================================================
   ABOUT
   ===================================================================== */
const partners = [['amp', 'AMP'], ['iron-core-group', 'Iron Core Group']];
emit('/about/', {
  title: 'About TECHNYAH: Automation Integrator in Lakeland, Florida',
  description: 'TECHNYAH is a Lakeland, Florida automation company that programs, integrates and repairs robots, controls and production machinery for manufacturers across Central Florida.',
  crumbs: [{ name: 'Home', url: '/' }, { name: 'About', url: '/about/' }], schema: [org],
  body: `${pageHero('About', 'Automation you can rely on', 'TECHNYAH takes its name from the Arabic word for technology. We put it to work on factory floors across Central Florida.')}
<section class="section"><div class="container">
  <div class="section-head"><p class="eyebrow">Who we are</p><h2>A hands-on automation company</h2>
  <p>TECHNYAH programs, integrates and repairs the robots, controls and machines that run production lines. We are based in ${esc(site.locality)}, ${esc(site.regionName)}, between Tampa and Orlando, and we work for manufacturers, packagers and distribution centers that need equipment to run every shift.</p></div>
  <dl class="values-grid">
    <div class="spec-row"><dt>Mission</dt><dd>To make dependable automation practical for every plant, not only the largest ones: equipment that is safe, efficient and understood by the people who run it.</dd></div>
    <div class="spec-row"><dt>How we work</dt><dd>Every job starts with the machine itself and a written scope. We build and test against that scope, commission with your team, and document what we hand over so you own it.</dd></div>
    <div class="spec-row"><dt>What we stand behind</dt><dd>Safety first, recognized standards, plain quotes and support after handover. We earn repeat work by getting the first job right.</dd></div>
    <div class="spec-row"><dt>Our scope</dt><dd>${esc(site.scopeNote)}</dd></div>
    <div class="spec-row"><dt>What we do not do</dt><dd>${esc(site.notOffered)}</dd></div>
  </dl>
</div></section>

<!-- Team: individual profiles are not shown publicly for now. Mohamed's card is kept here for later.
     To publish it, move the section below out of this comment and add public/images/team/mohamed.jpg.
<section class="section alt"><div class="container">
  <div class="section-head center"><p class="eyebrow">Our team</p><h2>The people behind the projects</h2></div>
  <div class="team-grid"><div class="team-member"><img src="/images/team/mohamed.jpg" alt="Mohamed Hadid" class="team-img"><h3>Mohamed Hadid</h3><p>Managing Partner, Automation &amp; Controls</p></div></div>
</div></section>
-->

<section class="section alt"><div class="container">
  <div class="section-head center"><p class="eyebrow">Partnerships</p><h2>Industry partners</h2><p>We work alongside established partners to deliver complete projects.</p></div>
  <div class="partners-row">${partners.map(([f, n]) => has(`images/partners/${f}.png`) ? `<img src="/images/partners/${f}.png" alt="${n}, industry partner" loading="lazy">` : `<span class="partner-chip">${n}</span>`).join('')}</div>
</div></section>
${ctaBand('Have a project in mind?', 'Tell us what you need to automate or fix.')}`,
}, { keywords: ['about', 'company', 'mission', 'partners', 'Lakeland'] });

/* =====================================================================
   CAREERS
   ===================================================================== */
emit('/careers/', {
  title: 'Careers at TECHNYAH: Automation Jobs & Internships in Lakeland, FL',
  description: 'Open positions and internships at TECHNYAH in automation, controls, mechanical design, computer vision and software. View details and apply online with your resume.',
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Careers', url: '/careers/' }],
  body: `${pageHero('Careers', 'Build automation with us', 'We look for people who care about doing things right. Read the details, then apply with your resume. Every application is read by a person.')}
<section class="section"><div class="container" style="max-width:900px">
  <div class="page-search"><label for="job-search" class="form-note" style="display:block;margin-bottom:6px">Search open positions</label>
    <input type="search" id="job-search" class="page-filter" data-target=".job-listing" placeholder="Try: intern, controls, software, CAD" aria-label="Search job listings"></div>
  <p class="no-results">No position matches that word. Send a general application to <a href="mailto:${esc(site.hrEmail)}">${esc(site.hrEmail)}</a>.</p>
  ${jobs.map(j => `<div class="job-listing" id="${j.id}">
  <button class="job-header" type="button" aria-expanded="false" aria-controls="body-${j.id}"><div><h3>${esc(j.title)}</h3><div class="job-meta"><span>${esc(j.location)}</span><span>${esc(j.type)}</span></div></div><span class="job-toggle-icon" aria-hidden="true">+</span></button>
  <div class="job-body" id="body-${j.id}">
    <p style="margin-top:18px">${esc(j.summary)}</p>
    <h4>Responsibilities</h4><ul>${j.responsibilities.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <h4>Qualifications</h4><ul>${j.qualifications.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <h4 style="margin-top:26px">Apply for this position</h4>
    ${apiForm('application', `<input type="hidden" name="position" value="${esc(j.title)}">
      ${field(`n-${j.id}`, 'Full name', `<input type="text" id="n-${j.id}" name="name" autocomplete="name" required>`)}
      ${field(`e-${j.id}`, 'Email', `<input type="email" id="e-${j.id}" name="email" autocomplete="email" required>`)}
      ${field(`p-${j.id}`, 'Phone (optional)', `<input type="tel" id="p-${j.id}" name="phone" autocomplete="tel">`)}
      ${field(`l-${j.id}`, 'LinkedIn or portfolio link (optional)', `<input type="url" id="l-${j.id}" name="link" placeholder="https://">`)}
      ${field(`m-${j.id}`, 'Why this role?', `<textarea id="m-${j.id}" name="message" required></textarea>`, { full: true })}
      ${field(`r-${j.id}`, 'Resume', `<input type="file" id="r-${j.id}" name="attachment" accept=".pdf,.doc,.docx" required><div class="file-preview" role="status"></div>`, { full: true, hint: 'PDF or Word, up to 10 MB.' })}`,
      'Submit application', `Your application goes to ${esc(site.hrEmail)}. See our <a href="/privacy/">privacy notice</a>.`, 'apply-form')}
  </div></div>`).join('\n')}
  <div class="card" style="margin-top:32px;text-align:center"><h3>No role that fits?</h3><p>Send a general application with your resume to <a href="mailto:${esc(site.hrEmail)}">${esc(site.hrEmail)}</a>.</p></div>
</div></section>`,
}, { search: false });
searchDocs.push({ u: '/careers/', t: 'Careers at TECHNYAH', h: '', x: 'Open positions and internships in automation, controls, mechanical design, computer vision and software. Apply online with your resume.', k: 'Page', kw: ['careers', 'jobs', 'hiring', 'internship', 'apply', 'resume'] });
jobs.forEach(j => searchDocs.push({ u: `/careers/#${j.id}`, t: j.title, h: `${j.type} · ${j.location}`, x: [j.summary, ...j.responsibilities, ...j.qualifications].join('. '), k: 'Job', kw: ['job', 'career', j.type] }));

/* =====================================================================
   CONTACT + QUOTE
   ===================================================================== */
const topics = ['General question', 'Machine problem', 'Project or quote', 'Partnership or subcontract work', 'Product', 'Careers', 'Something else'];
emit('/contact/', {
  title: 'Contact TECHNYAH: Automation Help in Lakeland, Florida',
  description: 'Contact TECHNYAH about a machine problem, an automation project or working together. Every message gets a reference number and a reply within one business day.',
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Contact', url: '/contact/' }], schema: [org],
  body: `${pageHero('Contact', 'Talk to our team', `Every message gets a reference number at once and a reply from a person within ${site.responseTime}.`)}
<section class="section"><div class="container">
  <div class="contact-direct">
    <div class="card"><p class="spec-label">General</p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></div>
    <div class="card"><p class="spec-label">Projects</p><a href="/quote/">Request a quote &rarr;</a></div>
    <div class="card"><p class="spec-label">Careers</p><a href="/careers/">Open positions &rarr;</a></div>
  </div>
  ${apiForm('contact', `
    ${field('c-name', 'Your name', '<input type="text" id="c-name" name="name" autocomplete="name" required>')}
    ${field('c-email', 'Email', '<input type="email" id="c-email" name="email" autocomplete="email" required>')}
    ${field('c-phone', 'Phone (optional)', '<input type="tel" id="c-phone" name="phone" autocomplete="tel">')}
    ${field('c-company', 'Company (optional)', '<input type="text" id="c-company" name="company" autocomplete="organization">')}
    ${field('c-topic', 'What is it about?', `<select id="c-topic" name="topic">${topics.map(t => `<option>${esc(t)}</option>`).join('')}</select>`)}
    ${field('c-subject', 'Subject', '<input type="text" id="c-subject" name="subject" required>')}
    ${field('c-message', 'Message', '<textarea id="c-message" name="message" required></textarea>', { full: true })}
    ${field('c-file', 'Attachment (optional)', `<input type="file" id="c-file" name="attachment" accept="${FILES_ANY}"><div class="file-preview" role="status"></div>`, { full: true, hint: 'Photos, drawings or documents, up to 10 MB.' })}`,
    'Send message', 'See our <a href="/privacy/">privacy notice</a>.')}
</div></section>`,
}, { keywords: ['contact', 'email', 'message', 'reach', 'support'] });

emit('/quote/', {
  title: 'Request a Quote: Automation, Robotics & Controls Projects',
  description: 'Request a quote from TECHNYAH for robot integration, PLC programming, conveyor controls, machine vision, custom machines or troubleshooting. Reply within one business day.',
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Request a quote', url: '/quote/' }],
  body: `${pageHero('Request a quote', 'Tell us about your project', 'Send what you have. Model numbers, a fault message and a few photos are enough to start.')}
<section class="section"><div class="container">
  ${apiForm('quote', `
    ${field('q-name', 'Your name', '<input type="text" id="q-name" name="name" autocomplete="name" required>')}
    ${field('q-company', 'Company', '<input type="text" id="q-company" name="company" autocomplete="organization">')}
    ${field('q-email', 'Email', '<input type="email" id="q-email" name="email" autocomplete="email" required>')}
    ${field('q-phone', 'Phone (optional)', '<input type="tel" id="q-phone" name="phone" autocomplete="tel">')}
    ${field('q-kind', 'What do you need?', '<select id="q-kind" name="request_type"><option value="Project or upgrade">A project or upgrade</option><option value="Machine down">A machine is down</option><option value="Training">Training</option><option value="Product">A product</option></select>')}
    ${field('q-service', 'Service', `<select id="q-service" name="service"><option value="">Not sure yet</option>${services.map(s => `<option value="${s.slug}">${esc(s.title)}</option>`).join('')}</select>`)}
    ${field('q-site', 'Site city', '<input type="text" id="q-site" name="site_city" placeholder="Lakeland, FL">')}
    ${field('q-when', 'When do you need it?', '<input type="text" id="q-when" name="timeline" placeholder="This week, next quarter">')}
    ${field('q-msg', 'What should the machine do, or what is going wrong?', '<textarea id="q-msg" name="message" required placeholder="Equipment, controller or robot model, fault message, and the result you want"></textarea>', { full: true })}
    ${field('q-file', 'Drawings, specs or photos (optional)', `<input type="file" id="q-file" name="attachment" accept="${FILES_ANY}"><div class="file-preview" role="status"></div>`, { full: true, hint: 'One file up to 10 MB. Zip several files together.' })}`,
    'Send quote request', 'Quotes are free. See our <a href="/privacy/">privacy notice</a>.')}
</div></section>`,
}, { keywords: ['quote', 'estimate', 'proposal', 'pricing', 'rfq', 'bid'] });

/* =====================================================================
   FAQ, SEARCH, PRIVACY, THANKS, 404
   ===================================================================== */
const faqGroups = {};
kb.filter(e => e.faq).forEach(e => (faqGroups[e.faq] = faqGroups[e.faq] || []).push({ id: 'q-' + e.id, q: e.q[0], a: e.a, more: e.links && e.links.find(l => l.u) ? [e.links.find(l => l.u).t, e.links.find(l => l.u).u] : null }));
faqGroups['Service questions'] = services.flatMap(s => s.faqs.map((f, n) => ({ id: `q-${s.slug}-${n + 1}`, q: f.q, a: f.a, more: [s.title, `/services/${s.slug}/`] })));
const allFaqs = Object.values(faqGroups).flat();
emit('/faq/', {
  title: 'Questions & Answers: Working with TECHNYAH',
  description: 'Answers to common questions about TECHNYAH: services, pricing, response time, brands we support, scope, service area and how to request a quote.',
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Questions', url: '/faq/' }], schema: [faqSchema(allFaqs)],
  body: `${pageHero('Questions', 'Questions and answers', 'Short answers to what people ask before they call. The assistant in the corner can answer these too.')}
<section class="section"><div class="container" style="max-width:860px">
${Object.entries(faqGroups).map(([g, list]) => `<h2 style="margin-top:34px">${esc(g)}</h2>${faqBlock(list)}`).join('\n')}
</div></section>
${ctaBand('Still have a question?', 'Ask it. A person replies within one business day.', ['/contact/', 'Contact us'], ['/quote/', 'Request a quote'])}`,
}, { search: false });
allFaqs.forEach(f => searchDocs.push({ u: `/faq/#${f.id}`, t: f.q, h: 'Questions', x: f.a, k: 'Answer' }));

emit('/search/', {
  title: 'Search TECHNYAH', description: 'Search TECHNYAH services, industries, products, jobs and answers.', noindex: true,
  body: `${pageHero('Search', 'Search the site', '')}
<section class="section"><div class="container" style="max-width:860px">
  <form class="search-form" action="/search/" method="get" role="search"><input type="search" name="q" id="search-q" placeholder="Search services, industries, jobs and answers" aria-label="Search the site" autocomplete="off"><button type="submit" class="cta-btn">Search</button></form>
  <p class="search-count" id="search-count" role="status"></p><div id="search-results"></div>
  <noscript><p class="note">Search needs JavaScript. You can browse <a href="/services/">services</a>, <a href="/industries/">industries</a> and <a href="/faq/">questions</a> instead.</p></noscript>
</div></section>`,
});

emit('/privacy/', {
  title: 'Privacy Notice', description: 'How TECHNYAH handles information sent through its website forms and assistant.',
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Privacy', url: '/privacy/' }],
  body: `${pageHero('Privacy', 'Privacy notice', `Last updated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`)}
<section class="section"><div class="container" style="max-width:800px">
  <h2>What we collect</h2><p>Only what you send us: the details you type into the contact, quote and job application forms, files you attach, and messages you ask the assistant to pass on. We also record the page you sent it from and the country your request came from.</p>
  <h2>How we use it</h2><p>To answer your request, prepare a quote or review your application. We do not sell it or use it for advertising.</p>
  <h2>Where it is kept</h2><p>Submissions are stored in ${esc(site.legalName)}'s private database on Cloudflare and are emailed to our team. Access is limited to the people who handle requests. Job applications are kept for up to twelve months.</p>
  <h2>The assistant and search</h2><p>NURA and site search run entirely in your browser. What you type is not sent anywhere unless you ask the assistant to send a message to the team. Your chat is kept in your browser tab and is cleared when you close it.</p>
  <h2>Cookies and tracking</h2><p>This site sets no advertising cookies. A spam check from Cloudflare may run when you submit a form.</p>
  <h2>Your choices</h2><p>To see, correct or delete what you sent us, email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> with your reference number.</p>
</div></section>`,
});

emit('/thanks/', {
  title: 'Message received', description: 'Your message has been received by TECHNYAH.', noindex: true,
  body: `${pageHero('Message received', 'Thank you. We have it.', `A person will reply within ${site.responseTime}.`)}
<section class="section"><div class="container" style="max-width:720px">
  <div class="form-status ok show"><h3>Your reference: <span class="ref" id="thanks-ref">sent</span></h3><p>Keep this number. Quote it if you email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> about this request.</p></div>
  <p style="margin-top:24px"><a href="/" class="cta-btn">Back to the home page</a></p>
</div></section>`,
});

emit('/404.html', {
  title: 'Page not found', description: 'That page does not exist on technyah.com.', noindex: true,
  body: `${pageHero('Error 404', 'That page is not here', 'It may have moved. Try a search or one of these.')}
<section class="section"><div class="container" style="max-width:860px">
  <form class="search-form" action="/search/" method="get" role="search"><input type="search" name="q" placeholder="Search the site" aria-label="Search the site"><button type="submit" class="cta-btn">Search</button></form>
  <ul class="chips" style="margin-top:24px"><li><a href="/services/">Services</a></li><li><a href="/industries/">Industries</a></li><li><a href="/quote/">Request a quote</a></li><li><a href="/contact/">Contact</a></li></ul>
</div></section>`,
}, { index: false, search: false });

/* =====================================================================
   STATIC FILES, DATA FILES, SITEMAP
   ===================================================================== */
fs.cpSync(PUB, OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(searchDocs));

// assistant knowledge: hand-written answers + answers generated from the catalog
const assistant = [
  ...kb.map(e => ({ id: e.id, q: e.q, kw: e.kw || [], a: e.a, links: e.links || [] })),
  ...services.flatMap(s => [
    { id: 'svc-' + s.slug, q: [`Do you do ${s.title.toLowerCase()}?`, `Tell me about ${s.title.toLowerCase()}`, ...s.keywords.slice(0, 5).map(k => `Can you help with ${k}?`)], kw: s.keywords,
      a: s.short + ' ' + s.intro[0], links: [{ t: s.title, u: `/services/${s.slug}/` }, { t: 'Start a quote here', flow: 'quote' }] },
    ...s.faqs.map((f, n) => ({ id: `svc-${s.slug}-${n + 1}`, q: [f.q], kw: s.keywords.slice(0, 4), a: f.a, links: [{ t: s.title, u: `/services/${s.slug}/` }] })),
  ]),
  ...industries.map(i => ({ id: 'ind-' + i.slug, q: [`Do you work with ${i.title.toLowerCase()}?`, `${i.title} automation`], kw: i.keywords, a: i.short + ' ' + i.intro, links: [{ t: i.title, u: `/industries/${i.slug}/` }] })),
  ...jobs.map(j => ({ id: 'job-' + j.id, q: [`${j.title} job`, `Is the ${j.title} position open?`], kw: ['job', 'position', j.type], a: `${j.title} (${j.type}, ${j.location}). ${j.summary}`, links: [{ t: 'View and apply', u: `/careers/#${j.id}` }] })),
];
fs.writeFileSync(path.join(OUT, 'assistant.json'), JSON.stringify({ name: 'NURA', email: site.email, responseTime: site.responseTime, entries: assistant }));

fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${site.url}${p.url}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${site.url}/sitemap.xml\n`);

const photoCount = Object.keys(photos).filter(k => has(`images/photos/${k}.jpg`)).length;
console.log(`built ${pages.length} indexable pages, ${searchDocs.length} search entries, ${assistant.length} assistant answers, ` +
  `${photoCount}/${Object.keys(photos).length} photos present (illustrations fill the rest) → dist/  [v=${VER}]`);
