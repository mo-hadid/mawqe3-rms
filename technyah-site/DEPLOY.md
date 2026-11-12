# Deploying technyah.com on Cloudflare Pages

Everything here runs on Cloudflare's free plan. Do Part A first; the site works after it.
Parts B to D switch on extras one at a time. `https://YOUR-SITE/api/health` shows what is on.

## Part A. Put the site online (about 15 minutes)

1. Replace the contents of your GitHub repository with this folder and push.
   Copy your partner logos to `public/images/partners/amp.png` and `iron-core-group.png`.
   Delete the old `CNAME` file; Cloudflare does not use it.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → choose the repository.
3. Build settings: Framework preset **None**, Build command `node build.mjs`, Build output directory `dist`.
   Add the environment variable `NODE_VERSION` = `22`. Save and deploy.
4. Open `https://<project>.pages.dev`. Every later `git push` redeploys by itself.

## Part B. Switch on the contact system

Each step is independent. After adding bindings or secrets, open **Deployments** and choose **Retry deployment**.

| # | What it gives you | Where in Cloudflare | Name to use |
|---|---|---|---|
| 1 | Every message saved with a reference number | **Storage & Databases → D1** → create `technyah`. Then Pages project → **Settings → Bindings → Add → D1** | `DB` |
| 2 | Resumes and drawings saved | **Storage & Databases → KV** → create `technyah-files`. Then **Bindings → Add → KV** | `FILES` |
| 3 | The private inbox at `/admin/` | Pages project → **Settings → Variables and Secrets → Add → Secret**. Use 32 or more random characters | `ADMIN_TOKEN` |
| 4 | Emails to info@, hr@ and mhadid@, with Reply-To set to the sender, plus a confirmation to the sender | Create a free account at resend.com, add the domain `technyah.com`, add the DNS records it lists, create an API key. Save the key as a **Secret** | `RESEND_API_KEY` |
| 5 | Spam check on every form | **Turnstile → Add widget** for `technyah.com`. Put the *site key* in `content/site.json` (`turnstileSiteKey`) and push. Save the *secret key* as a **Secret** | `TURNSTILE_SECRET` |

The table is created automatically on the first message. Nothing to run.

Optional plain variables: `MAIL_TO` (default info@technyah.com), `MAIL_HR` (hr@technyah.com), `MAIL_CC` (mhadid@technyah.com),
`MAIL_FROM` (`TECHNYAH <info@technyah.com>`), `SITE_URL`, `SEND_CONFIRMATION=off`.

## Part C. Move technyah.com to Cloudflare

1. Cloudflare → **Add a domain** → `technyah.com` → Free plan.
2. **Before changing nameservers**, compare the imported DNS records with your current ones. The `MX` and `TXT` records carry your email; if one is missing, add it.
3. At your registrar, switch to the two Cloudflare nameservers.
4. GitHub repository → **Settings → Pages** → remove the custom domain.
5. Pages project → **Custom domains** → add `technyah.com`, then `www.technyah.com`.
6. Optional: **Rules → Redirect Rules** → redirect `www.technyah.com/*` to `https://technyah.com/$1` (301).

## Part D. Get found

1. Google Search Console → add `technyah.com` → verify by DNS → submit `https://technyah.com/sitemap.xml`. Do the same in Bing Webmaster Tools.
2. Create a Google Business Profile for the Lakeland address and link the site.
3. Pages project → **Metrics** → enable Web Analytics (free, no cookie banner needed).
4. Add your street address, phone and LinkedIn URL to `content/site.json` when you are ready to publish them. They flow into the pages and the search-engine data.

## Day to day

| To do this | Do this |
|---|---|
| Change a service, industry, product or job | Edit the file in `content/`, push |
| Change what NURA answers | Edit `content/kb.json`, push. The FAQ page updates too |
| Use the logo you picked | `npm install` once, then `npm run logo apply 7` (your number), push |
| Add the photos | `npm run photos` on your computer, look at each one, push. Illustrations show until then |
| Preview on your computer | `npm install`, then `npm run dev` and open http://localhost:8788 |
| Undo a bad release | Pages project → **Deployments** → the last good one → **Rollback** |

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Build fails with "node: not found" or a syntax error | `NODE_VERSION` is missing. Set it to `22` and retry |
| Site shows the old GitHub version | DNS still points to GitHub. Finish Part C steps 3 to 5 and wait for the nameserver change |
| Form says "not able to deliver messages right now" | Neither storage nor email is configured. Check `/api/health`, then Part B steps 1 or 4 |
| `/api/health` shows `storage: false` after adding D1 | The binding name is not exactly `DB`, or you did not retry the deployment |
| Messages are saved but no email arrives | `email: false` → add `RESEND_API_KEY`. If `true`, the domain is not verified in Resend, or `MAIL_FROM` is not on that domain. Pages project → **Functions → Real-time logs** shows the reason |
| Email stopped after moving DNS | An `MX` or `TXT` record was not carried over. Re-add it (Part C step 2) |
| "The spam check did not pass" on every send | The site key and secret key are from different Turnstile widgets, or the widget does not list your domain |
| Inbox says "switched off" | `ADMIN_TOKEN` is missing or shorter than 16 characters |
| Inbox says "token was not accepted" | Paste the exact secret value; retry the deployment if you just changed it |
| "File did not come through" after an upload | `FILES` is not bound (step 2), or the file is over 10 MB |
| A page works on pages.dev but not on technyah.com | The custom domain is still "verifying". It finishes once nameservers have switched |
| Search or NURA shows nothing | `search-index.json` or `assistant.json` did not build. Run `npm run build` locally and read the last line |

## Security already in place

- HTTPS only, with a strict content security policy, no inline scripts, no third-party fonts or trackers (`public/_headers`).
- Honeypot field, timing check and optional Turnstile on every form; file type and size limits on uploads.
- The inbox API is closed unless `ADMIN_TOKEN` is set; uploads are readable only through it.
- No secrets live in this repository. Never commit a key.
- Recommended extra: **Zero Trust → Access** → protect `technyah.com/admin*` with your email (free up to 50 users), and one **WAF rate limiting rule** on `/api/submit`.

## Free-plan limits (checked November 2026)

Pages: 500 builds a month, 100 custom domains per project, 20,000 files per site. Functions share the Workers free allowance of 100,000 requests a day.
D1: 5 GB and 100,000 rows written a day. KV: 1 GB and 1,000 writes a day. Resend: 3,000 emails a month, 100 a day.
Sources: developers.cloudflare.com/pages/platform/limits · developers.cloudflare.com/workers/platform/pricing · resend.com/pricing
