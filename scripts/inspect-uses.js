const fs = require('fs');
const path = require('path');
const OUT = 'inspect-uses.txt';

function walk(d) {
  let r = [];
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    let s;
    try { s = fs.statSync(p); } catch { continue; }
    if (s.isDirectory()) {
      if (!['node_modules', '.git', 'backups', 'docs', 'power-bots'].includes(f)) r = r.concat(walk(p));
    } else if (f.endsWith('.js')) r.push(p);
  }
  return r;
}

const files = walk('.');
const uses = { mongoose: [], firebase: [], dotenv: [] };
for (const f of files) {
  const t = fs.readFileSync(f, 'utf-8');
  if (/require\(['"]mongoose['"]\)|from ['"]mongoose['"]/.test(t)) uses.mongoose.push(f);
  if (/require\(['"]firebase['"]\)|from ['"]firebase['"]/.test(t)) uses.firebase.push(f);
}

const lines = [];
lines.push('SCRIPTS/PUBLIC FILES CHECK');
lines.push('MONGOOSE USED IN:');
lines.push(uses.mongoose.length ? uses.mongoose.join('\n') : 'NONE');
lines.push('\nFIREBASE USED IN:');
lines.push(uses.firebase.length ? uses.firebase.join('\n') : 'NONE');
lines.push('\n--- package.json deps that are unused/harmful ---');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  lines.push('deps: ' + Object.keys(pkg.dependencies || {}).join(', '));
} catch (e) { lines.push('pkg err ' + e.message); }

fs.writeFileSync(OUT, lines.join('\n'), 'utf-8');
console.log('WROTE ' + OUT);
