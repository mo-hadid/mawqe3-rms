#!/usr/bin/env node
/* Downloads the photos listed in content/photos.json into public/images/photos/.
   Every photo is from Unsplash and free for commercial use under https://unsplash.com/license.
   Run once on your own computer:  npm run photos   then  npm run build
   Look at each picture before you publish. To swap one, change its "id" in content/photos.json
   (the part of any Unsplash image address after images.unsplash.com/), or drop your own JPG in with the same name. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const photos = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/photos.json'), 'utf8')); delete photos._readme;
const out = path.join(ROOT, 'public/images/photos'); fs.mkdirSync(out, { recursive: true });
let ok = 0; const credits = [];
for (const [key, p] of Object.entries(photos)) {
  const file = path.join(out, key + '.jpg');
  if (fs.existsSync(file) && !process.argv.includes('--force')) { console.log('kept   ', key); ok++; credits.push(`${key}.jpg: ${p.credit}, ${p.page}`); continue; }
  try {
    const res = await fetch(`https://images.unsplash.com/${p.id}?auto=format&fit=crop&w=1600&h=1067&q=72&fm=jpg`);
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('HTTP ' + res.status);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer())); ok++; credits.push(`${key}.jpg: ${p.credit}, ${p.page}`);
    console.log('saved  ', key);
  } catch (err) { console.log('FAILED ', key, '(' + err.message + '). Open', p.page, 'and save it as', path.relative(ROOT, file)); }
}
fs.writeFileSync(path.join(out, 'CREDITS.txt'), 'Photos from Unsplash (https://unsplash.com/license)\n\n' + credits.join('\n') + '\n');
console.log(`\n${ok}/${Object.keys(photos).length} photos ready. Now run: npm run build`);
