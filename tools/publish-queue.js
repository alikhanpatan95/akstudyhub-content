// Publishes today's Mains question and Topic of the day from queue/*.json into ak-data.json.
// Runs every morning from GitHub Actions, so it keeps working even when nobody else publishes.
// Skips either part if an item for today already exists. Usage: node tools/publish-queue.js [YYYY-MM-DD]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const today = process.argv[2] || new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // Asia/Kolkata
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('bad date ' + today);
const mmdd = today.slice(5, 7) + today.slice(8, 10);

const raw = fs.readFileSync(path.join(ROOT, 'ak-data.json'), 'utf8');
const D = JSON.parse(raw), O = JSON.parse(raw);
const QM = read('queue/mains.json'), QT = read('queue/topics.json');
const log = [];

// Mains
D.mains = Array.isArray(D.mains) ? D.mains : [];
if (D.mains.some(m => m.date === today)) log.push('mains: already has ' + today);
else if (!QM.length) log.push('mains: queue empty');
else {
  const m = QM.shift();
  let id = 'mains-' + mmdd;
  if (D.mains.some(x => x.id === id)) id += 'q';
  D.mains.unshift(Object.assign({ id, date: today }, m));
  D.mains = D.mains.slice(0, 60);
  log.push('mains: added ' + id);
}

// Topic of the day: always the first syllabus item not yet covered
const syl = D.syllabus; syl.done = syl.done || {};
const qt = QT.filter(t => !syl.done[t.id]);                      // drop items already covered
if (Object.values(syl.done).includes(today)) log.push('topic: already has ' + today);
else {
  const idx = syl.items.findIndex(i => !syl.done[i.id]);
  const next = syl.items[idx];
  const t = next && qt.find(x => x.id === next.id);
  if (!next) log.push('topic: syllabus finished');
  else if (!t) log.push('topic: ' + next.id + ' not in queue');
  else {
    qt.splice(qt.indexOf(t), 1);
    D.topics = Array.isArray(D.topics) ? D.topics : [];
    D.topics.unshift(Object.assign({ id: t.id, n: idx + 1, date: today }, t, { n: idx + 1 }));
    D.topics = D.topics.slice(0, 30);
    syl.done[t.id] = today;
    log.push('topic: added ' + t.id);
  }
}

if (!log.some(l => l.includes('added'))) { console.log(log.join('\n')); console.log('nothing to publish'); process.exit(0); }
D.rev = new Date().toISOString();
for (const k of ['settings', 'plans', 'pdfs', 'codes', 'ca', 'tests'])
  if (JSON.stringify(O[k]) !== JSON.stringify(D[k])) throw new Error('would change ' + k);
if (JSON.stringify(O.syllabus.items) !== JSON.stringify(D.syllabus.items)) throw new Error('would change syllabus.items');
fs.writeFileSync(path.join(ROOT, 'ak-data.json'), JSON.stringify(D));
fs.writeFileSync(path.join(ROOT, 'queue/mains.json'), JSON.stringify(QM, null, 1) + '\n');
fs.writeFileSync(path.join(ROOT, 'queue/topics.json'), JSON.stringify(qt, null, 1) + '\n');
JSON.parse(fs.readFileSync(path.join(ROOT, 'ak-data.json'), 'utf8'));
console.log(log.join('\n'));
console.log('queue left: ' + QM.length + ' mains, ' + qt.length + ' topics');
