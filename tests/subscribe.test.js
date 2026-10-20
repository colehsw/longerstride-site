const test = require('node:test');
const assert = require('node:assert');
const { score } = require('../public/scoring.js');
const Quiz = require('../public/quiz.js');
const handler = require('../api/subscribe.js');

const LINDA = {
  A1: '55-64', A2: 3.25, A3: 0, A4: 0.25, C1: 3.5, C2: 3.0, C3: 3.25, C4: 3.5, C5: 3.0, C6: 3.0, C7: 3.0, C8: 3.0, C9: 3.75, C10: 3.5,
  D1: 'C5', D2: 'level-up', D3: 1, B1: null, B2: 'never', B3: 3.0,
};
const body = extra => ({ email: 'Linda@Example.com', first_name: 'Linda', zip: '37205', consent: true, answers: { ...LINDA }, utm: { utm_source: 'meta', bogus: 'x' }, ...extra });

function fakeRes() {
  const r = { code: 0, json: null, headers: {} };
  r.status = c => { r.code = c; return r; };
  r.json = j => { r.body = j; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}

test('scoring engine is unchanged: Linda with an open-play anchor lands at 3.25', () => {
  const r = score(Quiz.toEngine(LINDA));
  assert.strictEqual(r.L, 3.25);
  assert.strictEqual(r.leaks.length, 3);
});

test('clean() keeps known answers and rejects made-up values', () => {
  assert.deepStrictEqual(Quiz.clean({ ...LINDA, extra: 1 }), LINDA);
  assert.strictEqual(Quiz.clean({ ...LINDA, C1: 9 }), null);
  const { C4, ...missing } = LINDA;
  assert.strictEqual(Quiz.clean(missing), null);
  assert.ok(Quiz.clean({ ...LINDA, B1: 3.62, B1b: '10+' }));
  assert.strictEqual(Quiz.clean({ ...LINDA, B1: '3.5' }), null, 'follow-up B1b is required once B1 is answered');
});

test('build() validates the form', () => {
  assert.ok(handler.build(body({ email: 'nope' })).error);
  assert.ok(handler.build(body({ consent: false })).error);
  assert.ok(handler.build(body({ zip: '123' })).error);
  assert.ok(handler.build(body({ answers: { C1: 3 } })).error);
});

test('build() scores on the server and maps to Klaviyo', () => {
  process.env.KLAVIYO_LIST_ID = 'LIST1';
  const out = handler.build(body({ level: 5 }));
  assert.strictEqual(out.email, 'linda@example.com');
  const p = out.profile.data.attributes;
  assert.strictEqual(p.properties.lc_level, 3.25);
  assert.strictEqual(p.properties.lc_utm_source, 'meta');
  assert.strictEqual(p.properties.lc_bogus, undefined);
  assert.strictEqual(p.location.zip, '37205');
  assert.strictEqual(out.subscription.data.relationships.list.data.id, 'LIST1');
  assert.strictEqual(out.event.data.attributes.properties.leaks.length, 3);
  assert.ok(out.event.data.attributes.properties.week3_drill);
  assert.strictEqual(out.event.data.attributes.metric.data.attributes.name, 'Completed Level Check');
});

test('handler calls profile import, subscribe, then event', async () => {
  process.env.KLAVIYO_PRIVATE_KEY = 'pk_test';
  process.env.KLAVIYO_LIST_ID = 'LIST1';
  const calls = [];
  global.fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 202, text: async () => '' }; };
  const res = fakeRes();
  await handler({ method: 'POST', body: body() }, res);
  assert.strictEqual(res.code, 200);
  assert.deepStrictEqual(calls.map(c => c.url.replace('https://a.klaviyo.com/api', '')), ['/profile-import', '/profile-subscription-bulk-create-jobs', '/events']);
  assert.strictEqual(calls[0].opts.headers.Authorization, 'Klaviyo-API-Key pk_test');
});

test('handler reports a Klaviyo failure, and ignores honeypot bots', async () => {
  process.env.KLAVIYO_PRIVATE_KEY = 'pk_test';
  let n = 0;
  global.fetch = async () => { n++; return { ok: false, status: 400, text: async () => 'bad' }; };
  const res = fakeRes();
  await handler({ method: 'POST', body: body() }, res);
  assert.strictEqual(res.code, 502);
  n = 0;
  const bot = fakeRes();
  await handler({ method: 'POST', body: body({ website: 'spam.biz' }) }, bot);
  assert.strictEqual(bot.code, 200);
  assert.strictEqual(n, 0);
});

test('handler refuses GET and missing keys', async () => {
  const g = fakeRes();
  await handler({ method: 'GET' }, g);
  assert.strictEqual(g.code, 405);
  delete process.env.KLAVIYO_PRIVATE_KEY;
  const m = fakeRes();
  await handler({ method: 'POST', body: body() }, m);
  assert.strictEqual(m.code, 500);
});
