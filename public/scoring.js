// Scoring engine for the Play Forever Level Check (from the Scoring Methodology doc).
const SKILLS = [
  { id: 'C1', name: 'Serve', w: 0.5 },
  { id: 'C2', name: 'Return', w: 0.75 },
  { id: 'C3', name: 'Third shot', w: 1.25 },
  { id: 'C4', name: 'Dinking', w: 1.25 },
  { id: 'C5', name: 'Volleys and hand battles', w: 1.0 },
  { id: 'C6', name: 'Resets and moving forward', w: 1.25 },
  { id: 'C7', name: 'Backhand', w: 0.75 },
  { id: 'C8', name: 'Unforced errors', w: 1.5 },
  { id: 'C9', name: 'Partner play', w: 0.75 },
  { id: 'C10', name: 'Shot choices', w: 1.0 },
];
const IMPORTANCE = { // up to 3.0 / 3.25-3.75 / 4.0+
  C1: [1.0, 0.5, 0.5], C2: [1.0, 0.75, 0.75], C3: [0.75, 1.5, 1.25], C4: [1.25, 1.25, 1.0], C5: [0.75, 1.0, 1.5],
  C6: [0.5, 1.25, 1.5], C7: [1.0, 1.0, 1.0], C8: [1.5, 1.25, 1.0], C9: [1.0, 1.0, 0.75], C10: [0.75, 1.0, 1.25],
};
const DRILLS = {
  C1: ['Deep-serve target: a towel in the back 3 ft, 20 serves', '14 of 20 land on the towel', 'Alternate deep-middle and deep-wide, 10 each', '7 of 10 each way'],
  C2: ['Return-and-run: return 20 serves deep and get to the kitchen line', '15 of 20 at the line before the third shot', 'Return to the backhand corner', '12 of 20 on target'],
  C3: ['Drop ladder: drops from mid-court, then the baseline, to a partner at the kitchen', '7 of 10 land in the kitchen before moving back', 'Drop or drive: a feeder mixes high and low returns, you choose', '7 of 10 good choices'],
  C4: ['Cross-court dink rally', '20 in a row', 'Dink game to 11, speed up only on high balls', 'Win at your level'],
  C5: ['Wall blocks from 7 ft', '3 sets of 50 soft volleys', '30-second fast-hands rounds with a partner', 'Win half'],
  C6: ['Partner drives at you in mid-court', '6 of 10 reset into the kitchen', 'Same drill, from the baseline', '6 of 10 resets'],
  C7: ['10 minutes of backhand-only dinking', '20 in a row', 'Backhand-only skinny singles', 'Win a game'],
  C8: ['Margin game: aim 1 to 2 ft over the net, misses count double', '1 fewer error per game each week', 'Margin game with targets in the back third', '1 fewer error per game each week'],
  C9: ['Rope drill: move with your partner as if tied by a 10-ft rope; forehand takes the middle', 'No gaps in a 10-minute game', 'Practice a stacking rotation', 'One full game with no mix-ups'],
  C10: ['Above-the-net only: attack only balls above net height', 'Fewer popped-up attacks each week', 'Target-the-feet game', 'More points won at the line'],
};
const DUPR_VALUES = { u3: 2.75, '3.0': 3.25, '3.5': 3.75, '4.0': 4.25, '4.5': 4.75 };

const r2 = x => Math.round(x * 100) / 100;
const roundQ = x => Math.round(x * 4) / 4;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const bandIndex = L => (L <= 3.0 ? 0 : L <= 3.75 ? 1 : 2);

function levelLabel(L) {
  const f = x => x.toFixed(1);
  const frac = Math.round((L % 0.5) * 100) / 100;
  if (frac === 0) return `A solid ${f(L)}`;
  return `A solid ${f(L - 0.25)}, knocking on ${f(L + 0.25)}`;

}

// a = answers: { A2, A3, A4, C1..C10 (levels), D1 (skill id), D3, dupr: {value, matches}|null, tourney: {level, medal}|null, openPlay: number|null }
function score(a) {
  const P = clamp(a.A2 + a.A3 + a.A4, 2.0, 4.5);
  const vals = SKILLS.map(s => a[s.id]);
  const sumW = SKILLS.reduce((t, s) => t + s.w, 0);
  const sRaw = SKILLS.reduce((t, s) => t + s.w * a[s.id], 0) / sumW;

  const caps = [];
  if (a.C3 <= 2.75) caps.push({ cap: 3.5, why: 'Third shot is mostly drives' });
  if (a.C4 <= 3.0) caps.push({ cap: 3.5, why: "Dink rallies don't last yet" });
  if (a.C6 <= 3.0) caps.push({ cap: 3.75, why: 'Getting to the kitchen line' });
  if (a.C8 <= 3.0) caps.push({ cap: 3.75, why: 'Unforced errors' });
  caps.push({ cap: Math.min(a.C3, a.C4, a.C6, a.C8) + 1.0, why: 'Weakest core skill + 1.0' });
  const lowest = caps.reduce((m, c) => (c.cap < m.cap ? c : m));
  let S = Math.min(sRaw, lowest.cap);
  const capBinding = lowest.cap < sRaw;

  const anchors = [];
  if (a.dupr) anchors.push({ kind: 'DUPR', value: a.dupr.value, w: a.dupr.matches === '10+' ? 3 : 1.5 });
  if (a.tourney) anchors.push(a.tourney.medal
    ? { kind: 'Tournament medal', value: a.tourney.level, w: 1.5 }
    : { kind: 'Tournament play', value: a.tourney.level - 0.25, w: 1 });
  if (a.openPlay != null) anchors.push({ kind: 'Open play', value: a.openPlay, w: 1 });

  const inflation = anchors.length === 0 ? 0.15 : 0;
  S -= inflation;

  const sumA = anchors.reduce((t, x) => t + x.w, 0);
  const Lraw = (3 * S + P + anchors.reduce((t, x) => t + x.w * x.value, 0)) / (4 + sumA);
  const L = clamp(roundQ(Lraw), 2.0, 5.0);

  let half;
  const dupr10 = a.dupr && a.dupr.matches === '10+';
  if (dupr10) half = 0.25;
  else if (anchors.length) half = anchors.every(x => Math.abs(x.value - S) <= 0.5) ? 0.25 : 0.5;
  else half = 0.5;
  const mean = vals.reduce((t, v) => t + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((t, v) => t + (v - mean) ** 2, 0) / vals.length);
  if (sd > 0.6) half += 0.25;
  const range = [clamp(L - half, 2.0, 5.0), clamp(L + half, 2.0, 5.0)];

  // Leaks
  const b = bandIndex(L), next = Math.min(2, b + 1);
  const leaks = SKILLS.map(s => ({
    ...s, level: a[s.id],
    score: Math.max(0, L - a[s.id]) * IMPORTANCE[s.id][b] + (a.D1 === s.id ? 0.25 : 0),
  }));
  const order = (x, y) => y.score - x.score || y.w - x.w || IMPORTANCE[y.id][next] - IMPORTANCE[x.id][next];
  let top = leaks.filter(l => l.score > 0).sort(order).slice(0, 3);
  if (top.length < 3) {
    const fill = SKILLS.filter(s => !top.some(t => t.id === s.id))
      .sort((x, y) => IMPORTANCE[y.id][next] - IMPORTANCE[x.id][next] || y.w - x.w)
      .slice(0, 3 - top.length).map(s => ({ ...s, level: a[s.id], score: 0, nextLevel: true }));
    top = top.concat(fill);
  }
  top = top.map(l => {
    const d = DRILLS[l.id], adv = l.level >= 3.5;
    return { ...l, score: r2(l.score), drill: adv ? d[2] : d[0], pass: adv ? d[3] : d[1], drillType: adv ? 'Advanced' : 'Foundation' };
  });

  return { P, sRaw: r2(sRaw), S: r2(S), capBinding, cap: lowest, inflation, anchors, Lraw: r2(Lraw), L, range, sd: r2(sd), leaks: top, label: levelLabel(L) };
}

if (typeof module !== 'undefined') module.exports = { score, SKILLS };
