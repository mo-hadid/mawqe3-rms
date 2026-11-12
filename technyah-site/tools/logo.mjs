// TECHNYAH logo kit. 24 hexagon + T concepts, wordmark converted to outlines.
//   node tools/logo.mjs list        show the concepts
//   node tools/logo.mjs apply 11    write concept 11 into public/images/brand/ (logos, favicons, share image)
//   node tools/logo.mjs all out/    export every concept as SVG
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const opentype = require('opentype.js');

const FONT_DIR = new URL('../node_modules/@fontsource', import.meta.url).pathname;
const loadFont = p => { const b = fs.readFileSync(p); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const fWord = loadFont(`${FONT_DIR}/barlow-condensed/files/barlow-condensed-latin-700-normal.woff`);
const fTag = loadFont(`${FONT_DIR}/barlow/files/barlow-latin-500-normal.woff`);

const NAVY = '#16293A', CYAN = '#00B4D8', WHITE = '#FFFFFF', DARK = '#0E1B25';
const r2 = n => +n.toFixed(2);

// ---- text → outline path -------------------------------------------------
export function textPath(font, text, x, y, size, tracking = 0) {
  let cx = x, d = '';
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    let adv = g.advanceWidth * scale;
    if (glyphs[i + 1]) adv += font.getKerningValue(g, glyphs[i + 1]) * scale;
    cx += adv + tracking;
  });
  return { d, width: cx - x - tracking };
}

// ---- geometry -------------------------------------------------------------
const hexPts = (R, flat = false, cx = 100, cy = 100) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i + (flat ? 30 : 0));
    return [cx + R * Math.sin(a), cy - R * Math.cos(a)];
  });
const P = pts => 'M' + pts.map(p => `${r2(p[0])} ${r2(p[1])}`).join(' L') + ' Z';
const hex = (R, flat) => P(hexPts(R, flat));
const outline = (t, R, sw, flat) => `<path d="${hex(R, flat)}" fill="none" stroke="${t.fg}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const rect = (x, y, w, h, fill, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"/>`;
const circ = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;
// standard solid T
const T = (fill, o = {}) => {
  const { bx = 54, by = 64, bw = 92, bh = 22, sw = 24, sb = 142, rx = 0 } = o;
  const sx = 100 - sw / 2;
  return rect(bx, by, bw, bh, fill, rx) + rect(sx, by + bh - 0.5, sw, sb - by - bh + 0.5, fill, rx);
};

// ---- the concepts ---------------------------------------------------------
// t = { fg, ac, bg }  → main colour, accent, background (for knock-outs)
export const concepts = [
  { id: 'frame', name: 'Frame', note: 'The current direction, tightened: outlined cell, solid T, one signal node.',
    draw: t => outline(t, 86, 13) + T(t.fg, { sb: 136 }) + circ(100, 147, 7, t.ac) },

  { id: 'solid', name: 'Solid', note: 'Filled hexagon with the T cut out. Strongest at small sizes and on hard hats.',
    draw: t => `<path d="${hex(90)}" fill="${t.fg}" stroke="${t.fg}" stroke-width="6" stroke-linejoin="round"/>`
      + T(t.bg, { by: 62, bh: 23, sw: 26, sb: 150 }) + rect(87, 140, 26, 10, t.ac) },

  { id: 'split', name: 'Split', note: 'Three machined blocks; the gaps between them draw the T. No T is printed at all.',
    draw: (t, u) => `<clipPath id="h${u}"><path d="${hex(92)}"/></clipPath><g clip-path="url(#h${u})">`
      + rect(0, 0, 200, 62, t.fg) + rect(0, 80, 91, 120, t.fg) + rect(109, 80, 91, 120, t.fg) + '</g>' + circ(100, 71, 5, t.ac) },

  { id: 'tslot', name: 'T-Slot', note: 'A T-slot extrusion profile, the building block of every machine frame.',
    draw: t => `<path d="${hex(92, true)}" fill="${t.fg}"/>` + rect(50, 58, 100, 25, t.bg) + rect(86, 82, 28, 102, t.bg)
      + circ(100, 70.5, 5.5, t.ac) },

  { id: 'circuit', name: 'Circuit', note: 'The T as board traces with solder pads at each end.',
    draw: t => outline(t, 86, 10)
      + `<path d="M58 74 H142 M100 74 V134" stroke="${t.fg}" stroke-width="11" stroke-linecap="round" fill="none"/>`
      + [[58, 74], [142, 74], [100, 134]].map(([x, y]) => circ(x, y, 11, t.bg, ` stroke="${t.fg}" stroke-width="7"`)).join('')
      + circ(100, 74, 8.5, t.ac) },

  { id: 'gripper', name: 'Gripper', note: 'A T that is also a two-finger robot gripper closing on a part.',
    draw: t => outline(t, 86, 12) + T(t.fg, { bx: 52, bw: 96, by: 62, bh: 20, sw: 24, sb: 142 })
      + rect(52, 81, 15, 24, t.fg) + rect(133, 81, 15, 24, t.fg) + rect(52, 98, 15, 7, t.ac) + rect(133, 98, 15, 7, t.ac) },

  { id: 'truss', name: 'Truss', note: 'The T is the hexagon\'s own geometry: one diameter and one radius, like a frame member.',
    draw: t => `<path d="${hex(86, true)}" fill="none" stroke="${t.fg}" stroke-width="12" stroke-linejoin="round"/>`
      + `<path d="M14 100 H186 M100 100 V174" stroke="${t.fg}" stroke-width="12" fill="none"/>` + circ(100, 100, 13, t.bg, ` stroke="${t.fg}" stroke-width="7"`) + circ(100, 100, 5, t.ac) },

  { id: 'arm', name: 'Arm', note: 'A robot arm seen head-on: base column, shoulder joint, two links.',
    draw: t => outline(t, 86, 10) + rect(89, 78, 22, 62, t.fg) + rect(74, 136, 52, 10, t.fg, 2) + rect(54, 66, 92, 16, t.fg, 8)
      + circ(100, 74, 15, t.bg, ` stroke="${t.fg}" stroke-width="7"`) + circ(100, 74, 5, t.ac) },

  { id: 'gantry', name: 'Gantry', note: 'A cartesian gantry: beam, carriage, Z-axis and a tool tip at work.',
    draw: t => outline(t, 86, 10) + rect(46, 64, 108, 14, t.fg) + rect(46, 77, 12, 20, t.fg) + rect(142, 77, 12, 20, t.fg)
      + rect(83, 56, 34, 30, t.fg, 3) + rect(93, 85, 14, 42, t.fg) + `<path d="M88 127 H112 L100 146 Z" fill="${t.ac}"/>` },

  { id: 'taa', name: 'Taa', note: 'Two dots over the bar turn the T into the Arabic letter that starts the name.',
    draw: t => outline(t, 86, 12) + rect(83, 50, 14, 14, t.ac, 2) + rect(103, 50, 14, 14, t.ac, 2)
      + T(t.fg, { by: 80, bh: 20, sb: 146 }) },

  { id: 'pads', name: 'Pads', note: 'Three status windows in the bar, like indicator lamps. This is the mark on the site today.',
    draw: t => outline(t, 86, 12) + T(t.fg, { bx: 50, bw: 100, by: 60, bh: 28, sb: 144 })
      + rect(60, 68, 20, 12, t.ac, 2) + rect(90, 68, 20, 12, t.ac, 2) + rect(120, 68, 20, 12, t.ac, 2) },

  { id: 'pixel', name: 'Pixel', note: 'The T as camera pixels with one lit: machine vision.',
    draw: t => outline(t, 86, 9)
      + [52, 72, 92, 112, 132].map(x => rect(x, 60, 16, 16, x === 92 ? t.ac : t.fg, 1.5)).join('')
      + [80, 100, 120].map(y => rect(92, y, 16, 16, t.fg, 1.5)).join('') },

  { id: 'monoline', name: 'Monoline', note: 'One line weight throughout. Light, technical, drawing-sheet feel.',
    draw: t => outline(t, 86, 8)
      + `<path d="M54 62 H146 V85 H112 V142 H88 V85 H54 Z" fill="none" stroke="${t.fg}" stroke-width="8" stroke-linejoin="round"/>`
      + circ(100, 73.5, 4.5, t.ac) },

  { id: 'duality', name: 'Duality', note: 'Half solid, half outline: hardware on one side, software on the other.',
    draw: (t, u) => `<clipPath id="l${u}"><rect x="0" y="0" width="100" height="200"/></clipPath><clipPath id="r${u}"><rect x="100" y="0" width="100" height="200"/></clipPath>`
      + `<g clip-path="url(#l${u})"><path d="${hex(92)}" fill="${t.fg}"/>${T(t.bg, { by: 64, sb: 142 })}</g>`
      + `<g clip-path="url(#r${u})">${outline(t, 86, 12)}${T(t.fg, { by: 64, sb: 142 })}</g>` + circ(100, 156, 6.5, t.ac) },

  { id: 'soft', name: 'Soft', note: 'Rounded corners throughout. Friendlier; reads as an app icon.',
    draw: t => `<path d="${hex(78)}" fill="${t.fg}" stroke="${t.fg}" stroke-width="26" stroke-linejoin="round"/>`
      + rect(56, 62, 88, 24, t.bg, 9) + rect(88, 72, 24, 70, t.bg, 9) + circ(100, 158, 7, t.ac) },

  { id: 'tag', name: 'Tag', note: 'The hexagon opened into code brackets: <T>. Software and machine in one.',
    draw: t => `<path d="M62 28 L20 100 L62 172 M138 28 L180 100 L138 172" fill="none" stroke="${t.fg}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`
      + T(t.fg, { bx: 62, bw: 76, by: 64, bh: 20, sw: 22, sb: 138 }) + circ(100, 152, 6.5, t.ac) },

  { id: 'gear', name: 'Gear', note: 'Six teeth on the flats make the cell a gear.',
    draw: t => [0, 1, 2, 3, 4, 5].map(i => `<rect x="88" y="20" width="24" height="18" rx="2" fill="${t.fg}" transform="rotate(${30 + 60 * i} 100 100)"/>`).join('')
      + outline(t, 74, 12) + T(t.fg, { bx: 64, bw: 72, by: 72, bh: 18, sw: 20, sb: 130 }) + circ(100, 140, 5, t.ac) },

  { id: 'nodes', name: 'Nodes', note: 'Six I/O points on the corners, one live. A network in miniature.',
    draw: t => outline(t, 80, 7) + hexPts(80).map((p, i) => circ(r2(p[0]), r2(p[1]), 10, i === 1 ? t.ac : t.fg)).join('')
      + T(t.fg, { bx: 60, bw: 80, by: 70, bh: 19, sw: 22, sb: 138 }) },

  { id: 'nut', name: 'Nut', note: 'A hex nut with the T in the bore: hardware first.',
    draw: t => `<path d="${hex(92)}" fill="${t.fg}"/>` + circ(100, 100, 55, t.bg) + circ(100, 100, 55, 'none', ` stroke="${t.ac}" stroke-width="4"`)
      + T(t.fg, { bx: 66, bw: 68, by: 72, bh: 18, sw: 20, sb: 134 }) },

  { id: 'cap', name: 'Cap', note: 'Colour-blocked: a cyan roof over a solid body.',
    draw: (t, u) => `<clipPath id="c${u}"><path d="${hex(92)}"/></clipPath><g clip-path="url(#c${u})">`
      + rect(0, 0, 200, 50, t.ac) + rect(0, 58, 200, 142, t.fg) + '</g>' + T(t.bg, { by: 74, bh: 22, sw: 26, sb: 156 }) },

  { id: 'keystone', name: 'Keystone', note: 'The T is structural: its bar closes the cell and its stem is the spine.',
    draw: t => `<path d="M22 60 V145 L100 190 L178 145 V60" fill="none" stroke="${t.fg}" stroke-width="12" stroke-linejoin="round"/>`
      + rect(16, 44, 168, 22, t.fg, 3) + rect(89, 65, 22, 112, t.fg) + rect(89, 49, 22, 12, t.ac, 2) },

  { id: 'probe', name: 'Probe', note: 'A pointed stem: a probe, a pin, a tool touching down exactly.',
    draw: t => outline(t, 86, 12) + rect(52, 62, 96, 22, t.fg)
      + `<path d="M87 83 H113 V130 L100 150 L87 130 Z" fill="${t.fg}"/>` + circ(100, 163, 5, t.ac) },

  { id: 'fine', name: 'Fine line', note: 'Thin and quiet, with the accent on the frame. Premium, less industrial.',
    draw: t => outline(t, 88, 5)
      + `<path d="M60 72 H140 M100 72 V142" stroke="${t.fg}" stroke-width="6" stroke-linecap="round" fill="none"/>` + circ(100, 12, 7.5, t.ac) },

  { id: 'vision', name: 'Vision', note: 'Corner brackets only, like a camera locking onto its target.',
    draw: t => {
      const p = hexPts(88); let d = '';
      p.forEach((v, i) => { const a = p[(i + 5) % 6], b = p[(i + 1) % 6], k = 0.3;
        d += `M${r2(v[0] + (a[0] - v[0]) * k)} ${r2(v[1] + (a[1] - v[1]) * k)} L${r2(v[0])} ${r2(v[1])} L${r2(v[0] + (b[0] - v[0]) * k)} ${r2(v[1] + (b[1] - v[1]) * k)} `; });
      return `<path d="${d}" fill="none" stroke="${t.fg}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`
        + T(t.fg, { bx: 60, bw: 80, by: 68, bh: 19, sw: 22, sb: 136 }) + circ(100, 148, 5.5, t.ac); } },
];

// ---- assembling SVG files -------------------------------------------------
const LIGHT = { fg: NAVY, ac: CYAN, bg: WHITE };
const ONDARK = { fg: WHITE, ac: CYAN, bg: DARK };

export const markSVG = (c, t, u = 'm') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">${c.draw(t, u)}</svg>`;

const TAGLINE = 'AUTOMATION  ·  ROBOTICS  ·  CONTROLS';
const word = textPath(fWord, 'TECHNYAH', 0, 0, 112, 4);
// fit the tagline exactly under the wordmark by solving for the tracking
const tag0 = textPath(fTag, TAGLINE, 0, 0, 19, 0);
const TAG_TRACK = (word.width - 4 - tag0.width) / (TAGLINE.length - 1);
const tag = textPath(fTag, TAGLINE, 0, 0, 19, TAG_TRACK);
const LW = Math.ceil(232 + word.width + 24);

export const lockupSVG = (c, t, u = 'k') => {
  const w = textPath(fWord, 'TECHNYAH', 232, 118, 112, 4);
  const g = textPath(fTag, TAGLINE, 234, 160, 19, TAG_TRACK);
  const tagFill = t.fg === WHITE ? '#48CAE4' : '#0077B6';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LW} 200" fill="none">`
    + `<g transform="translate(6 6) scale(0.94)">${c.draw(t, u)}</g>`
    + `<path d="${w.d}" fill="${t.fg}"/><path d="${g.d}" fill="${tagFill}"/></svg>`;
};


// compact lockup: mark + wordmark, no tagline (site header)
const LWC = Math.ceil(232 + textPath(fWord, 'TECHNYAH', 0, 0, 120, 4).width + 16);
export const compactSVG = (c, t, u = 'h') => {
  const w = textPath(fWord, 'TECHNYAH', 232, 142, 120, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LWC} 200" fill="none">`
    + `<g transform="translate(6 6) scale(0.94)">${c.draw(t, u)}</g><path d="${w.d}" fill="${t.fg}"/></svg>`;
};

// ---- command line ---------------------------------------------------------
const [cmd, arg] = process.argv.slice(2);
const pick = n => { const c = concepts[Number(n) - 1]; if (!c) { console.error(`No concept ${n}. Use 1 to ${concepts.length}.`); process.exit(1); } return c; };

if (cmd === 'list') {
  concepts.forEach((c, i) => console.log(String(i + 1).padStart(2, '0'), c.name.padEnd(10), c.note));
} else if (cmd === 'all') {
  const out = path.resolve(arg || 'logo-export'); fs.mkdirSync(out, { recursive: true });
  concepts.forEach((c, i) => { const n = String(i + 1).padStart(2, '0');
    fs.writeFileSync(path.join(out, `${n}-${c.id}-mark.svg`), markSVG(c, LIGHT, `a${i}`));
    fs.writeFileSync(path.join(out, `${n}-${c.id}-mark-white.svg`), markSVG(c, ONDARK, `b${i}`));
    fs.writeFileSync(path.join(out, `${n}-${c.id}-logo.svg`), lockupSVG(c, LIGHT, `c${i}`));
    fs.writeFileSync(path.join(out, `${n}-${c.id}-logo-white.svg`), lockupSVG(c, ONDARK, `d${i}`)); });
  console.log(`exported ${concepts.length} concepts to ${out}`);
} else if (cmd === 'apply') {
  const c = pick(arg);
  const out = new URL('../public/images/brand/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
  const files = { 'mark.svg': markSVG(c, LIGHT, 'm1'), 'mark-white.svg': markSVG(c, ONDARK, 'm2'),
    'logo.svg': lockupSVG(c, LIGHT, 'l1'), 'logo-white.svg': lockupSVG(c, ONDARK, 'l2'),
    'logo-compact.svg': compactSVG(c, LIGHT, 'c1'), 'logo-compact-white.svg': compactSVG(c, ONDARK, 'c2') };
  for (const [f, svg] of Object.entries(files)) fs.writeFileSync(out + f, svg);
  fs.writeFileSync(out + 'concept.json', JSON.stringify({ n: Number(arg), id: c.id, name: c.name }));
  try {
    const sharp = (await import('sharp')).default;
    const mark = Buffer.from(files['mark.svg']);
    await sharp(mark, { density: 300 }).resize(32, 32).png().toFile(out + 'favicon-32.png');
    await sharp(mark, { density: 600 }).resize(512, 512).png().toFile(out + 'favicon-512.png');
    await sharp({ create: { width: 180, height: 180, channels: 4, background: '#FFFFFF' } })
      .composite([{ input: await sharp(mark, { density: 400 }).resize(140, 140).png().toBuffer(), left: 20, top: 20 }]).png().toFile(out + 'apple-touch-icon.png');
    const lock = await sharp(Buffer.from(files['logo-white.svg']), { density: 300 }).resize({ width: 860 }).png().toBuffer();
    const grid = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0E1B25"/><defs><pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#00B4D8" stroke-opacity=".09"/></pattern></defs><rect width="1200" height="630" fill="url(#g)"/><rect y="622" width="1200" height="8" fill="#00B4D8"/></svg>`);
    const meta = await sharp(lock).metadata();
    await sharp(grid).composite([{ input: lock, left: Math.round((1200 - meta.width) / 2), top: Math.round((630 - meta.height) / 2) }]).png().toFile(out + 'og-image.png');
    console.log('wrote SVG logos, favicons and og-image.png');
  } catch (e) { console.log('wrote SVG logos (PNG favicons skipped: ' + e.message.split('\n')[0] + ')'); }
  console.log(`applied concept ${arg} (${c.name}) to public/images/brand/`);
} else {
  console.log('usage: node tools/logo.mjs list | apply <number> | all [folder]');
}
