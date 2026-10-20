// Level Check page: one question per screen, an email gate, then the result.
// Questions live in quiz.js and scoring in scoring.js; this file only draws screens and sends the signup.
const { PARTS, QUESTIONS, toEngine } = window.Quiz;
const CONFIG = window.LS_CONFIG || {};

const SAMPLE = { // Linda, 62, from the methodology doc
  A1: '55-64', A2: 3.25, A3: 0, A4: 0.25, C1: 3.5, C2: 3.0, C3: 3.25, C4: 3.5, C5: 3.0, C6: 3.0, C7: 3.0, C8: 3.0, C9: 3.75, C10: 3.5,
  D1: 'C5', D2: 'level-up', D3: 1, B1: null, B2: 'never', B3: 3.0,
};
const ANSWER_IDS = QUESTIONS.map(q => q.id);

let state = {}, idx = -1, view = 'intro', person = {}, signup = 'idle', isSample = false;
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const visible = () => window.Quiz.visible(state);

// Ad and link attribution, kept for this visit so Klaviyo can tie each subscriber to the ad that brought them.
const UTM = (() => {
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  const p = new URLSearchParams(location.search), out = {};
  keys.forEach(k => { if (p.get(k)) out[k] = p.get(k).slice(0, 200); });
  try {
    if (Object.keys(out).length) sessionStorage.setItem('ls_utm', JSON.stringify(out));
    else return JSON.parse(sessionStorage.getItem('ls_utm') || '{}');
  } catch (e) { /* storage blocked: use what the URL has */ }
  return out;
})();

function track(name, params) {
  if (typeof window.fbq === 'function') window.fbq('track', name, params || {});
}

function render() {
  window.scrollTo({ top: 0 });
  if (view === 'intro') return renderIntro();
  if (view === 'q') return renderQ();
  if (view === 'gate') return renderGate();
  if (view === 'result') return renderResult();
}

function renderIntro() {
  app.innerHTML = `<section class="screen">
    <p class="eyebrow">Free Level Check</p>
    <h1>What's your real pickleball level?</h1>
    <p>Answer honestly about a typical game, not your best day. You'll get an estimated level with a range, the three skills holding you back, and a 30-day plan to fix them.</p>
    <div class="facts"><div><b>20</b><span>questions</span></div><div><b>4 min</b><span>about</span></div><div><b>Free</b><span>30-day plan</span></div></div>
    <div class="row"><button class="btn" id="start">Start the quiz</button><button class="link" id="sample">See a sample result</button></div>
    <p class="muted">Your result is an estimate, not an official rating. If you have a DUPR, we ask for it at the end so it can't sway your other answers.</p>
  </section>`;
  document.getElementById('start').onclick = () => { state = {}; isSample = false; idx = 0; view = 'q'; track('ViewContent', { content_name: 'Level Check start' }); render(); };
  document.getElementById('sample').onclick = () => { state = { ...SAMPLE }; isSample = true; person = { name: 'Linda' }; view = 'result'; render(); };
}

function renderQ() {
  const qs = visible(), q = qs[idx], pct = Math.round((idx / qs.length) * 100);
  const chosen = state[q.id];
  const has = Object.prototype.hasOwnProperty.call(state, q.id);
  app.innerHTML = `<section class="screen">
    <div class="progress"><div class="meta"><span class="part">${PARTS[q.part]}</span><span>${idx + 1} of ${qs.length}</span></div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div></div>
    <div class="stack"><h2 id="qh">${esc(q.q)}</h2>${q.sub ? `<p class="muted">${esc(q.sub)}</p>` : ''}</div>
    <div class="answers" role="group" aria-labelledby="qh">
      ${q.opts.map((o, i) => `<button class="opt" data-i="${i}" aria-pressed="${has && chosen === o[1] && !(q.exact && typeof chosen === 'number') ? 'true' : 'false'}">${esc(o[0])}</button>`).join('')}
    </div>
    ${q.exact ? `<label class="field" for="dupr-exact">Know your exact number? <span class="hint">For example 3.62</span>
      <div class="row"><input type="number" id="dupr-exact" inputmode="decimal" step="0.01" min="2" max="8" value="${typeof chosen === 'number' ? chosen : ''}" style="max-width:10rem"><button class="btn ghost" id="use-exact">Use this number</button></div></label>
      <p class="err" id="exact-err" hidden>Enter a rating between 2.00 and 8.00.</p>` : ''}
    <div class="nav"><button class="link" id="back">${idx === 0 ? 'Back to start' : 'Back'}</button></div>
  </section>`;
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => answer(q, q.opts[+b.dataset.i][1]));
  document.getElementById('back').onclick = () => { if (idx === 0) { view = 'intro'; } else { idx--; } render(); };
  if (q.exact) document.getElementById('use-exact').onclick = () => {
    const v = parseFloat(document.getElementById('dupr-exact').value);
    if (!(v >= 2 && v <= 8)) { document.getElementById('exact-err').hidden = false; return; }
    answer(q, Math.round(v * 100) / 100);
  };
}

function answer(q, v) {
  state[q.id] = v;
  if (q.id === 'B1' && v == null) delete state.B1b;
  if (q.id === 'B2' && v === 'never') delete state.B2b;
  const qs = visible();
  const pos = qs.indexOf(q);
  if (pos + 1 < qs.length) { idx = pos + 1; render(); }
  else { view = 'gate'; render(); }
}

function renderGate() {
  app.innerHTML = `<section class="screen">
    <div class="progress"><div class="meta"><span class="part">Almost done</span><span>Last step</span></div><div class="bar"><span style="width:100%"></span></div></div>
    <h2>Your result is ready. Where should we send your 30-day plan?</h2>
    <form id="gate" class="stack" novalidate>
      <label class="field" for="g-name">First name<input type="text" id="g-name" autocomplete="given-name" maxlength="60" value="${esc(person.name || '')}"></label>
      <label class="field" for="g-email">Email<input type="email" id="g-email" autocomplete="email" required maxlength="200" value="${esc(person.email || '')}"></label>
      <label class="field" for="g-zip">ZIP code <span class="hint">Optional. We'll tell you about socials and clubs near you.</span><input type="text" id="g-zip" inputmode="numeric" autocomplete="postal-code" maxlength="5" value="${esc(person.zip || '')}"></label>
      <div class="hp" aria-hidden="true"><label for="g-website">Leave this empty</label><input type="text" id="g-website" tabindex="-1" autocomplete="off"></div>
      <label class="check" for="g-consent"><input type="checkbox" id="g-consent"><span>Send me my 30-day plan and the Play Forever Weekly newsletter. Unsubscribe anytime. See our <a href="/privacy">privacy policy</a>.</span></label>
      <p class="err" id="g-err" role="alert" hidden></p>
      <div class="row"><button class="btn" type="submit">Show my level</button><button class="link" type="button" id="g-back">Back</button></div>
    </form>
  </section>`;
  document.getElementById('g-back').onclick = () => { view = 'q'; idx = visible().length - 1; render(); };
  document.getElementById('gate').onsubmit = e => {
    e.preventDefault();
    const email = document.getElementById('g-email').value.trim(), err = document.getElementById('g-err');
    const zip = document.getElementById('g-zip').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter an email address like name@example.com.'; err.hidden = false; return; }
    if (zip && !/^\d{5}$/.test(zip)) { err.textContent = 'Enter a 5-digit ZIP code, or leave it blank.'; err.hidden = false; return; }
    if (!document.getElementById('g-consent').checked) { err.textContent = 'Tick the box so we can email your plan.'; err.hidden = false; return; }
    person = { name: document.getElementById('g-name').value.trim(), email, zip, website: document.getElementById('g-website').value };
    view = 'result'; render();
    send();
  };
}

async function send() {
  signup = 'sending'; showSignup();
  const answers = {};
  ANSWER_IDS.forEach(id => { if (Object.prototype.hasOwnProperty.call(state, id)) answers[id] = state[id]; });
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: person.email, first_name: person.name, zip: person.zip, consent: true, website: person.website, answers, utm: UTM }),
    });
    signup = res.ok ? 'done' : 'failed';
  } catch (e) { signup = 'failed'; }
  if (signup === 'done') track('Lead', { content_name: 'Level Check' });
  showSignup();
}

function showSignup() {
  const box = document.getElementById('signup');
  if (!box) return;
  if (signup === 'sending') box.innerHTML = '<p class="muted">Saving your plan…</p>';
  else if (signup === 'done') box.innerHTML = `<p>We'll email each week's drill to <b>${esc(person.email)}</b>, with step-by-step instructions. Check your inbox for week 1.</p>`;
  else if (signup === 'failed') {
    box.innerHTML = `<div class="notice" role="alert"><p>We couldn't save your email just now, so your plan won't arrive yet.</p>
      <div class="row"><button class="btn" id="retry">Try again</button></div></div>`;
    document.getElementById('retry').onclick = send;
  } else box.innerHTML = '';
}

const drillUrl = l => `/drills/${(window.DRILL_LINKS || {})[l.id]}-${l.drillType.toLowerCase()}`;

const SESSIONS = ['One 10-minute drill before your games', 'One 30-minute practice session', 'Two practice sessions', 'Two or three practice sessions'];

function renderResult() {
  const r = score(toEngine(state));
  const pos = x => ((x - 2) / 3) * 100;
  const f2 = x => x.toFixed(2);
  const sess = SESSIONS[state.D3 ?? 0];
  const leaks = r.leaks;
  const anchorsTxt = r.anchors.length ? r.anchors.map(a => `<dt>${esc(a.kind)} (weight ${a.w})</dt><dd>${f2(a.value)}</dd>`).join('') : '<dt>Ratings you gave</dt><dd>None</dd>';
  const site = CONFIG.siteUrl || location.origin;
  const share = `I'm ${r.label.charAt(0).toLowerCase() + r.label.slice(1)} on the Play Forever Level Check. What's your level? ${site}`;

  app.innerHTML = `<section class="screen">
    ${isSample ? '<p class="notice">This is a sample result for Linda, 62. Take the quiz to get your own.</p>' : ''}
    <div class="hero">
      <p class="eyebrow">${person.name ? esc(person.name) + "'s" : 'Your'} estimated level</p>
      <div class="levelnum"><div class="ball" aria-hidden="true">${r.L.toFixed(2)}</div>
        <div class="lbl"><h1 class="result-h">${esc(r.label)}</h1><p class="muted">Likely range ${r.range[0].toFixed(2)} to ${r.range[1].toFixed(2)}</p></div></div>
      <div class="scale" role="img" aria-label="Level ${r.L.toFixed(2)} on a scale from 2.0 to 5.0, range ${r.range[0].toFixed(2)} to ${r.range[1].toFixed(2)}">
        <div class="track"></div>
        <div class="band" style="left:${pos(r.range[0])}%;width:${pos(r.range[1]) - pos(r.range[0])}%"></div>
        <div class="dot" style="left:${pos(r.L)}%"></div>
        <div class="ticks"><span>2.0</span><span>2.5</span><span>3.0</span><span>3.5</span><span>4.0</span><span>4.5</span><span>5.0</span></div>
      </div>
      <p class="muted">${r.anchors.length ? 'The ratings you shared narrowed your range.' : 'Add a DUPR, tournament or open-play level next time to narrow your range.'} This is an estimate, not an official rating.</p>
    </div>

    <div class="stack"><h2>${leaks.some(l => l.nextLevel) ? 'What gets you to the next level' : 'The three skills holding you back'}</h2>
      ${leaks.map((l, i) => `<div class="card leak"><span class="n">${i + 1}</span><div>
        <h3>${esc(l.name)}</h3>
        <span class="pill">${l.drillType} drill</span>
        <p>${esc(l.drill)}.</p><p class="muted">You've got it when: ${esc(l.pass)}.</p>
        <a class="drill-more" href="${drillUrl(l)}">See the full drill</a></div></div>`).join('')}
    </div>

    <div class="card"><h2>Your 30-day plan</h2>
      <p class="muted">Each week: ${esc(sess.toLowerCase())}. Start every session with the <a href="/warm-up">5-Minute Play Forever Warm-Up</a>.</p>
      <ul class="weeks">
        <li><b>Week 1</b><span>${esc(leaks[0].name)} drill</span></li>
        <li><b>Week 2</b><span>${esc(leaks[1].name)} drill, plus 5 minutes of week 1</span></li>
        <li><b>Week 3</b><span>${esc(leaks[2].name)} drill, plus 5 minutes of weeks 1 and 2</span></li>
        <li><b>Week 4</b><span>Game-based drills for all three, then retake this quiz</span></li>
      </ul>
      <div id="signup" aria-live="polite"></div>
    </div>

    <div class="card"><h2>Share your level</h2>
      <p>Send it to your regular partner and see if they agree.</p>
      <div class="share" id="share-text">${esc(share)}</div>
      <div class="row">${navigator.share ? '<button class="btn" id="native-share">Share</button>' : ''}<button class="btn ghost" id="copy">Copy text</button><span class="muted" id="copied" hidden>Copied</span></div>
    </div>

    <details><summary>How we got your level</summary>
      <dl class="math">
        <dt>Skill score (weighted, 10 skills)</dt><dd>${f2(r.sRaw)}</dd>
        <dt>${r.capBinding ? 'Capped by: ' + esc(r.cap.why) : 'Skill caps'}</dt><dd>${r.capBinding ? f2(r.cap.cap) : 'None applied'}</dd>
        ${r.inflation ? `<dt>Self-rating correction</dt><dd>−${r.inflation.toFixed(2)}</dd>` : ''}
        <dt>Playing history</dt><dd>${f2(r.P)}</dd>
        ${anchorsTxt}
        <dt>Blended (skills count 3×)</dt><dd>${f2(r.Lraw)}</dd>
        <dt>Rounded to nearest 0.25</dt><dd>${r.L.toFixed(2)}</dd>
      </dl>
    </details>

    <div class="row"><button class="btn ghost" id="retake">${isSample ? 'Take the quiz' : 'Retake the quiz'}</button></div>
  </section>`;
  showSignup();
  document.getElementById('retake').onclick = () => { state = {}; isSample = false; signup = 'idle'; idx = 0; view = 'q'; render(); };
  const ns = document.getElementById('native-share');
  if (ns) ns.onclick = () => navigator.share({ text: share }).catch(() => {});
  document.getElementById('copy').onclick = () => {
    const done = () => { document.getElementById('copied').hidden = false; };
    try {
      navigator.clipboard.writeText(share).then(done, () => selectShare());
    } catch (e) { selectShare(); }
  };
}
function selectShare() {
  const range = document.createRange(); range.selectNodeContents(document.getElementById('share-text'));
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}

render();
