const fs = require('fs');
const path = require('path');
const g = fs.readFileSync('utils/guards/check-no-new-product-surface.cjs', 'utf8');
const tags = g.match(/const MODAL_SURFACE_TAGS = \[([\s\S]*?)\];/)[1]
  .split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
const re = new RegExp('<(' + tags.join('|') + ')\b', 'g');
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : (p.endsWith('.tsx') && !p.includes('.test.') ? [p] : []);
  });
}
const rows = [];
let total = 0;
for (const f of walk(path.join('src', 'mobile', 'app'))) {
  const s = fs.readFileSync(f, 'utf8');
  const c = new Map();
  for (const m of s.matchAll(re)) c.set(m[1], (c.get(m[1]) || 0) + 1);
  if (!c.size) continue;
  const summary = [...c].sort().map(([t, n]) => `${t}:${n}`).join(',');
  for (const [, n] of c) total += n;
  rows.push(`${f.split(path.sep).join('/')}|${summary}`);
}
console.log('current total mounts =', total, '(baseline says 59)');
console.log('tags:', tags.join(', '), '\n');
rows.sort().forEach((r) => console.log('  ' + r));
