// POST /api/subscribe: the Level Check email gate.
// Re-scores the answers with the same engine the page uses, then in Klaviyo:
//   1. creates or updates the profile with the level and leaks (for segments and the level-matched Weekly drill),
//   2. subscribes the email to the Play Forever Weekly list with marketing consent,
//   3. records a "Completed Level Check" event carrying the 30-day plan, which starts the welcome flow.
// Needs KLAVIYO_PRIVATE_KEY and KLAVIYO_LIST_ID in the Vercel environment. The key never reaches the browser.
const { score } = require('../public/scoring.js');
const Quiz = require('../public/quiz.js');
const DRILL_PAGES = require('../content/drills.js');

const KLAVIYO = 'https://a.klaviyo.com/api';
const REVISION = '2024-10-15';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Turns a request body into what Klaviyo gets, or an error message for the visitor.
function build(body) {
  if (!body || typeof body !== 'object') return { error: 'Missing form data.' };
  const email = str(body.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Enter an email address like name@example.com.' };
  if (body.consent !== true) return { error: 'Tick the box so we can email your plan.' };
  const zip = str(body.zip, 5);
  if (zip && !/^\d{5}$/.test(zip)) return { error: 'Enter a 5-digit ZIP code, or leave it blank.' };
  const answers = Quiz.clean(body.answers);
  if (!answers) return { error: 'Some quiz answers are missing. Please retake the quiz.' };

  const r = score(Quiz.toEngine(answers));
  const range = `${r.range[0].toFixed(1)}-${r.range[1].toFixed(1)}`;
  const utm = {};
  const rawUtm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  UTM_KEYS.forEach(k => { const v = str(rawUtm[k], 200); if (v) utm[k] = v; });

  const profileProps = {
    lc_level: r.L, lc_level_range: range, lc_label: r.label,
    lc_leak_1: r.leaks[0].name, lc_leak_2: r.leaks[1].name, lc_leak_3: r.leaks[2].name,
    lc_leak_1_id: r.leaks[0].id, lc_leak_2_id: r.leaks[1].id, lc_leak_3_id: r.leaks[2].id,
    lc_anchor_type: r.anchors.length ? r.anchors.map(a => a.kind).join(', ') : 'none',
    lc_goal: answers.D2, lc_practice_sessions: answers.D3, lc_age_band: answers.A1,
    lc_frustration: answers.D1, lc_completed_at: new Date().toISOString(),
    // Goal "play pain-free longer" flags interest in the body and recovery assessment that comes later.
    lc_future_body_assessment: answers.D2 === 'pain-free',
  };
  Object.keys(utm).forEach(k => { profileProps['lc_' + k] = utm[k]; });

  const eventProps = {
    quiz: 'play_forever_level_check', level: r.L, level_range: range, label: r.label,
    practice_sessions: answers.D3, goal: answers.D2,
    leaks: r.leaks.map((l, i) => ({ week: i + 1, id: l.id, name: l.name, drill: l.drill, pass: l.pass, drill_type: l.drillType })),
    ...utm,
  };
  // Flat copies so flow emails can use {{ event.week1_drill }} without list lookups.
  r.leaks.forEach((l, i) => {
    eventProps[`week${i + 1}_skill`] = l.name;
    eventProps[`week${i + 1}_drill`] = l.drill;
    eventProps[`week${i + 1}_pass`] = l.pass;
    eventProps[`week${i + 1}_url`] = `https://longerstride.com/drills/${DRILL_PAGES[l.id].slug}-${l.drillType.toLowerCase()}`;
  });

  const firstName = str(body.first_name, 60);
  return {
    email, level: r.L,
    profile: {
      data: { type: 'profile', attributes: {
        email, ...(firstName ? { first_name: firstName } : {}),
        ...(zip ? { location: { zip, country: 'United States' } } : {}),
        properties: profileProps,
      } },
    },
    subscription: {
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          custom_source: 'Level Check',
          profiles: { data: [{ type: 'profile', attributes: { email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } }] },
        },
        relationships: { list: { data: { type: 'list', id: process.env.KLAVIYO_LIST_ID } } },
      },
    },
    event: {
      data: { type: 'event', attributes: {
        properties: eventProps,
        metric: { data: { type: 'metric', attributes: { name: 'Completed Level Check' } } },
        profile: { data: { type: 'profile', attributes: { email } } },
        time: new Date().toISOString(),
      } },
    },
  };
}

async function klaviyo(path, payload) {
  const res = await fetch(KLAVIYO + path, {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_KEY}`,
      revision: REVISION,
      accept: 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Klaviyo ${path} ${res.status}: ${(await res.text()).slice(0, 500)}`);
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST.' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }

  // Bots fill the hidden "website" field; pretend it worked and send nothing.
  if (body && typeof body.website === 'string' && body.website.trim()) return res.status(200).json({ ok: true });

  const out = build(body);
  if (out.error) return res.status(400).json({ error: out.error });
  if (!process.env.KLAVIYO_PRIVATE_KEY || !process.env.KLAVIYO_LIST_ID) {
    console.error('subscribe: KLAVIYO_PRIVATE_KEY or KLAVIYO_LIST_ID is not set');
    return res.status(500).json({ error: 'Signup is not switched on yet.' });
  }
  try {
    await klaviyo('/profile-import', out.profile);
    await klaviyo('/profile-subscription-bulk-create-jobs', out.subscription);
  } catch (e) {
    console.error('subscribe:', e.message);
    return res.status(502).json({ error: "We couldn't save your email just now." });
  }
  try {
    await klaviyo('/events', out.event);
  } catch (e) {
    // The person is subscribed; a missing event only delays the welcome flow, so don't fail the signup.
    console.error('subscribe event:', e.message);
  }
  return res.status(200).json({ ok: true, level: out.level });
}

module.exports = handler;
module.exports.build = build;
