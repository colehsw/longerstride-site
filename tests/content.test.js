const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DRILLS = require('../content/drills.js');
const { build } = require('../scripts/build.js');
const handler = require('../api/subscribe.js');

// scoring.js only exports score and SKILLS, so read its DRILLS table by running the file in a sandbox.
const engine = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/scoring.js'), 'utf8') + ';({ DRILLS, SKILLS })', {});

test('every skill has a Foundation and an Advanced drill page that matches the scoring engine', () => {
  assert.strictEqual(JSON.stringify(Object.keys(DRILLS).sort()), JSON.stringify(engine.SKILLS.map(s => s.id).sort()));
  for (const id of Object.keys(DRILLS)) {
    const [fDrill, fPass, aDrill, aPass] = engine.DRILLS[id];
    assert.strictEqual(DRILLS[id].foundation.summary, fDrill, `${id} foundation summary`);
    assert.strictEqual(DRILLS[id].foundation.pass, fPass, `${id} foundation pass`);
    assert.strictEqual(DRILLS[id].advanced.summary, aDrill, `${id} advanced summary`);
    assert.strictEqual(DRILLS[id].advanced.pass, aPass, `${id} advanced pass`);
    for (const t of ['foundation', 'advanced']) {
      const d = DRILLS[id][t];
      for (const k of ['name', 'time', 'need', 'setup', 'easier', 'harder']) assert.ok(d[k], `${id} ${t} ${k}`);
      assert.ok(d.steps.length >= 2 && d.mistakes.length >= 2, `${id} ${t} steps and mistakes`);
    }
  }
});

test('generated pages in public/ are up to date (run npm run build)', () => {
  for (const [f, html] of Object.entries(build())) {
    assert.strictEqual(fs.readFileSync(path.join(__dirname, '../public', f), 'utf8'), html, `${f} is stale`);
  }
});

test('the Klaviyo event links each week to a drill page that exists', () => {
  process.env.KLAVIYO_LIST_ID = 'LIST1';
  const answers = {
    A1: '55-64', A2: 3.25, A3: 0, A4: 0.25, C1: 3.5, C2: 3.0, C3: 3.25, C4: 3.5, C5: 3.0, C6: 3.0, C7: 3.0, C8: 3.0, C9: 3.75, C10: 3.5,
    D1: 'C5', D2: 'level-up', D3: 1, B1: null, B2: 'never', B3: 3.0,
  };
  const props = handler.build({ email: 'a@b.co', consent: true, answers }).event.data.attributes.properties;
  for (const w of [1, 2, 3]) {
    const url = props[`week${w}_url`];
    assert.match(url, /^https:\/\/longerstride\.com\/drills\/[a-z-]+-(foundation|advanced)$/);
    assert.ok(fs.existsSync(path.join(__dirname, '../public', url.replace('https://longerstride.com', '') + '.html')), url);
  }
});
