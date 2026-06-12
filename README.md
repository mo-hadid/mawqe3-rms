# TECHNYAH Website — Deployment & Operations Guide

Static site for technyah.com, hosted on GitHub Pages with the custom domain set in `CNAME`.

---

## 1. Deploying this update

1. Replace the files in the GitHub repository with the contents of this folder.
   Keep the existing `/images` folder — all pages still reference it.
2. Commit and push. GitHub Pages redeploys automatically within a couple of minutes.
3. In the repo: **Settings → Pages → check "Enforce HTTPS"** (required).

Files in this package: `index.html`, `about.html`, `services.html`, `products.html`,
`careers.html`, `contact.html`, `quote.html`, `thanks.html`, `404.html`,
`styles.css`, `main.js`, `searchIndex.json`, `robots.txt`, `sitemap.xml`, `CNAME`.

---

## 2. Activating the email forms (REQUIRED — one-time step)

Forms use **FormSubmit.co** (free, no account, no API keys, works on static hosting).
Reference: https://formsubmit.co/documentation

| Form | Sends to | CC |
|---|---|---|
| Contact Us | info@technyah.com | mhadid@technyah.com |
| Get a Quote | info@technyah.com | mhadid@technyah.com |
| Careers (with resume attachment) | hr@technyah.com | — |

**Activation:** the FIRST submission to each address triggers a confirmation email
from FormSubmit to that inbox. Someone must click "Activate" in that email once.
Do this after deploying:

1. Submit a test message on the Contact page → activate from the info@technyah.com inbox.
2. Submit a test application on the Careers page → activate from the hr@technyah.com inbox.

**Prerequisite:** `info@`, `hr@`, and `mhadid@technyah.com` must be real, receivable
mailboxes. If they don't exist yet, the free options are:
- **Cloudflare Email Routing** (free): forwards info@/hr@/mhadid@technyah.com to any
  existing inbox (Gmail, etc.). https://developers.cloudflare.com/email-routing/
- **Zoho Mail Forever Free plan**: real hosted mailboxes on your domain (web access).

**Optional hardening (recommended after activation):** FormSubmit gives each activated
email a random-string endpoint (shown in the activation email). Replace
`formsubmit.co/info@technyah.com` in `contact.html`/`quote.html` and
`formsubmit.co/hr@technyah.com` in `careers.html` with that random endpoint so the
email addresses aren't scrapeable from the page source.

**Spam controls in place:** hidden `_honey` honeypot field on every form;
CAPTCHA is currently disabled (`_captcha=false`) for a smoother client experience.
If spam becomes a problem, delete the `_captcha` hidden input to restore
FormSubmit's built-in CAPTCHA.

**Limits:** total attachments per submission ≤ 10 MB (enforced client-side on the
careers page as well).

---

## 3. Hosting & security (low-cost/free setup)

Current hosting — **GitHub Pages** — is the right choice: free, fast CDN, free
TLS certificate, no server to patch. Keep it, and add:

1. **Enforce HTTPS** in repo Settings → Pages (one checkbox).
2. **Cloudflare Free plan** in front of the domain (move DNS to Cloudflare):
   - Free WAF managed rules, bot fight mode, DDoS protection, caching.
   - Enables **Email Routing** (solves the mailbox problem above for $0).
   - Lets you add security headers via a free "Transform Rule" or Snippet:
     `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
     `Referrer-Policy: strict-origin-when-cross-origin`, and a
     `Content-Security-Policy` once the script sources are finalized.
     (GitHub Pages itself cannot set custom response headers.)
3. **Repo hygiene:** enable 2FA on the GitHub account, restrict who can push,
   and never commit API keys (this build requires none).
4. **Privacy fix already applied:** the old careers page saved applicant name,
   email, and message to browser localStorage — removed.
5. The Tawk.to live-chat snippet was loading a placeholder ID on every page
   (a broken third-party script). It is now commented out in `index.html` with
   instructions; re-enable only with a real property ID from a free tawk.to account.

If you ever outgrow GitHub Pages, **Cloudflare Pages** or **Netlify** (free tiers)
are drop-in replacements — Netlify also has built-in form handling (100
submissions/month free) that could replace FormSubmit later.

---

## 4. Making TECHNYAH bid-ready (credibility roadmap)

The site now presents the trust signals clients check before inviting a bid:
real contact paths that work, standards-oriented language, a response-time
commitment, and a professional careers page. To bid competitively on industrial
work, build these out next (roughly in order of cost/effort):

**Free / immediate**
- Google Business Profile for the Lakeland address (maps + reviews).
- LinkedIn company page linked from the footer.
- Add 2–3 anonymized project case studies to the Portfolio section
  (problem → solution → result), with photos of real panels/cells.
- Publish a Capability Statement PDF (one page: NAICS codes, core competencies,
  differentiators, past performance, contact) — this is the standard document
  requested in industrial and government bid processes.

**Low cost / registrations that unlock bids**
- **SAM.gov registration** (free) + UEI number — required for any federal work
  and often referenced by primes.
- Register on **MyFloridaMarketPlace** (state) and the vendor portals of local
  entities (Polk County, City of Lakeland use online vendor registration) —
  free, and these publish RFQs/ITBs you can bid directly.
- General liability + professional liability insurance certificates ready to
  attach to bids (most ITBs require proof).

**Medium term**
- UL 508A panel shop listing (if/when you build panels in-house) — a major
  differentiator for control panel work.
- Membership in CSIA (Control System Integrators Association) or local AGC/ABC
  chapters for network and bid leads.
- Collect client testimonials/reference letters after each delivered project.

---

## 5. What was fixed in this rebuild

- **Contact & Quote forms now actually send email** (previous EmailJS code had
  placeholder IDs and never worked). Recipients: info@ + CC mhadid@.
- **Careers page reworked**: full job details (responsibilities, qualifications,
  location, type), resume upload (PDF/Word, 10 MB guard), applications emailed
  to hr@technyah.com; removed localStorage storage of applicant personal data.
- **Quote page**: the Product/Service selector now toggles fields correctly —
  previously the hidden required fields silently blocked every submission, and
  the toggle script didn't exist at all.
- **index.html**: removed a script that ran before the page body existed
  (caused a JS error on every load) and three duplicated hamburger handlers.
- **Consolidated** the search + nav scripts duplicated on every page into one
  shared `main.js`.
- **Team section**: Erynn and Noah removed; Mohamed retained in the code but
  commented out (see `about.html`, "Team" section) per instructions.
- **Products page**: replaced placeholder spinning-cube 3D viewers (three.js)
  with clean product cards and "Request Pricing" CTAs.
- **Design**: unified professional design system (industrial navy + brand cyan,
  Barlow type family), consistent sticky header/footer on every page, fully
  responsive desktop/tablet/mobile, accessible (skip links, focus states,
  ARIA on menus/accordions, reduced-motion support).
- **SEO & polish**: meta descriptions on all pages, favicon, robots.txt,
  sitemap.xml, custom 404 page, thank-you page for form redirects.
