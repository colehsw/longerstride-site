// Builds the drill pages, the drill index, the warm-up page and drill-links.js from content/.
// The output is committed, so Vercel serves plain files with no build step. Run `npm run build` after editing content/.
const fs = require('fs');
const path = require('path');
const DRILLS = require('../content/drills.js');
const WARMUP = require('../content/warm-up.js');
const { SKILLS } = require('../public/scoring.js');

const PUB = path.join(__dirname, '..', 'public');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TIERS = [['foundation', 'Foundation'], ['advanced', 'Advanced']];
const skillName = id => SKILLS.find(s => s.id === id).name;
const drillSlug = (id, tier) => `${DRILLS[id].slug}-${tier}`;

function page({ title, description, body, depth = 0 }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} | Longer Stride</title>
<meta name="description" content="${esc(description)}">
<meta property="og:site_name" content="Longer Stride">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="https://longerstride.com/og.png">
<meta name="theme-color" content="#1F3A2E">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css">
<script src="/config.js"></script>
<script src="/pixel.js"></script>
</head>
<body>
<div class="wrap">
  <header class="brand">
    <a class="wordmark" href="/" aria-label="Longer Stride home">
      <span class="name">Longer Stride</span>
      <svg class="line" viewBox="0 0 220 14" aria-hidden="true"><line x1="2" y1="7" x2="200" y2="7" stroke="currentColor" stroke-width="3" stroke-linecap="round"></line><circle cx="210" cy="7" r="5.5" fill="#D7E04F" stroke="#1F3A2E" stroke-width="1.5"></circle></svg>
    </a>
    <span class="tag">Play Forever</span>
  </header>
  <main class="prose">
${body}
  </main>
  <footer class="foot">
    <span>© 2026 Longer Stride</span>
    <a href="/">Take the Level Check</a>
    <a href="/privacy">Privacy</a>
  </footer>
</div>
</body>
</html>
`;
}

const list = (items, tag = 'ul') => `<${tag}>${items.map(i => `<li>${esc(i)}</li>`).join('')}</${tag}>`;

function drillPage(id, tier, label) {
  const skill = DRILLS[id], d = skill[tier];
  const other = TIERS.find(t => t[0] !== tier);
  const body = `    <p class="eyebrow">${esc(skillName(id))} · ${label} drill</p>
    <h1>${esc(d.name)}</h1>
    <p>${esc(skill.why)}</p>
    <div class="facts drill-facts"><div><b>${esc(d.time)}</b><span>time</span></div><div class="wide"><b class="small">${esc(d.need)}</b><span>what you need</span></div></div>
    <div class="card pass"><p class="eyebrow">You've got it when</p><p class="pass-line">${esc(d.pass)}.</p></div>
    <h2>Setup</h2>
    <p>${esc(d.setup)}</p>
    <h2>How to do it</h2>
    ${list(d.steps, 'ol')}
    <h2>Common mistakes</h2>
    ${list(d.mistakes)}
    <h2>Make it easier</h2>
    <p>${esc(d.easier)}</p>
    <h2>Make it harder</h2>
    <p>${esc(d.harder)}</p>
    <p class="muted">Start every session with the <a href="/warm-up">5-Minute Play Forever Warm-Up</a>. Ready for the next step? Try the <a href="/drills/${drillSlug(id, other[0])}">${other[1]} ${esc(skillName(id).toLowerCase())} drill</a>.</p>
    <div class="row"><a class="btn" href="/drills">All drills</a><a class="btn ghost" href="/">Take the Level Check</a></div>`;
  return page({ title: `${d.name}: a ${label.toLowerCase()} ${skillName(id).toLowerCase()} drill`, description: `${d.summary}. You've got it when: ${d.pass}.`, body });
}

function indexPage() {
  const rows = Object.keys(DRILLS).map(id => `    <div class="card"><h2>${esc(skillName(id))}</h2>
      <p class="muted">${esc(DRILLS[id].why)}</p>
      <ul class="drill-links">${TIERS.map(([t, label]) => `<li><a href="/drills/${drillSlug(id, t)}"><span class="pill">${label}</span> ${esc(DRILLS[id][t].name)}</a></li>`).join('')}</ul>
    </div>`).join('\n');
  const body = `    <p class="eyebrow">Play Forever drills</p>
    <h1>20 drills for the 10 skills that decide your level</h1>
    <p>Foundation drills build the basic skill. Advanced drills add choices and pressure. Not sure where to start? <a href="/">Take the Level Check</a> and get the three drills that will help you most.</p>
${rows}`;
  return page({ title: 'Pickleball drills for every level', description: '20 pickleball drills, a Foundation and an Advanced drill for each of the 10 skills in the Play Forever Level Check.', body });
}

function warmupPage() {
  const body = `    <p class="eyebrow">Before every game</p>
    <h1>${esc(WARMUP.title)}</h1>
    <p>${esc(WARMUP.intro)}</p>
    <ol class="moves">${WARMUP.moves.map(m => `<li class="card"><h2>${esc(m.name)} <span class="muted time">${esc(m.time)}</span></h2><p>${esc(m.how)}</p><p class="muted">${esc(m.tip)}</p></li>`).join('')}</ol>
    <p class="muted">${esc(WARMUP.note)}</p>
    <div class="row"><a class="btn" href="/">Take the Level Check</a><a class="btn ghost" href="/drills">See the drills</a></div>`;
  return page({ title: WARMUP.title, description: WARMUP.intro, body });
}

function build() {
  const files = {};
  for (const id of Object.keys(DRILLS)) for (const [t, label] of TIERS) files[`drills/${drillSlug(id, t)}.html`] = drillPage(id, t, label);
  files['drills/index.html'] = indexPage();
  files['warm-up.html'] = warmupPage();
  const links = Object.fromEntries(Object.keys(DRILLS).map(id => [id, DRILLS[id].slug]));
  files['drill-links.js'] = `// Generated by scripts/build.js from content/drills.js. Skill id -> drill page slug.\nwindow.DRILL_LINKS = ${JSON.stringify(links)};\n`;
  return files;
}

if (require.main === module) {
  const files = build();
  fs.mkdirSync(path.join(PUB, 'drills'), { recursive: true });
  for (const [f, html] of Object.entries(files)) fs.writeFileSync(path.join(PUB, f), html);
  console.log(`Wrote ${Object.keys(files).length} files to public/`);
}

module.exports = { build, drillSlug };
