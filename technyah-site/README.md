# technyah.com

Static site plus a small contact API, built for Cloudflare Pages. See **DEPLOY.md** to put it online.

| Folder | What is in it |
|---|---|
| `content/` | Everything you edit: services, industries, products, jobs, site details, assistant answers, photo list |
| `public/` | Styles, scripts, fonts, logos, illustrations, the private inbox page. Copied as-is |
| `functions/` | The API: `/api/submit`, `/api/health`, `/api/admin/*` |
| `build.mjs` | Turns `content/` + `public/` into `dist/`. No dependencies |
| `tools/` | `logo.mjs` (24 logo concepts, apply one by number) and `fetch-photos.mjs` |

How the pieces work:

- **Search and NURA** run in the visitor's browser from `search-index.json` and `assistant.json`. No AI service, no tokens, no cost.
- **Forms** post to `/api/submit`, which stores the message, emails the team with Reply-To set to the sender, and returns a reference such as `TNY-Q-261112-7K3F`.
- **Inbox** at `/admin/` lists every message, with status, notes, reply link and file download.
- **Old addresses** such as `/about.html` redirect to the new ones (`public/_redirects`).
