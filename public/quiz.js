// Level Check questions and answer handling, shared by the page and /api/subscribe.
// The server re-scores from these answers, so a result in Klaviyo always matches the scoring engine.
(function (root) {
  const PARTS = { A: 'Background', C: 'Your game', D: 'Your goals', B: 'Ratings you have' };
  const LEVELS5 = [['2.5 or beginner', 2.5], ['3.0', 3.0], ['3.5', 3.5], ['4.0', 4.0], ['4.5 and up', 4.5]];
  
  const QUESTIONS = [
    { id: 'A1', part: 'A', q: 'How old are you?', opts: [['Under 30', 'u30'], ['30 to 39', '30-39'], ['40 to 49', '40-49'], ['50 to 54', '50-54'], ['55 to 64', '55-64'], ['65 to 74', '65-74'], ['75 or older', '75+']] },
    { id: 'A2', part: 'A', q: 'How long have you played pickleball?', opts: [['Under 3 months', 2.25], ['3 to 12 months', 2.75], ['1 to 2 years', 3.25], ['2 to 4 years', 3.5], ['4 years or more', 3.75]] },
    { id: 'A3', part: 'A', q: 'How often do you play?', opts: [['Once a week or less', -0.25], ['2 to 3 times a week', 0], ['4 or more times a week', 0.25]] },
    { id: 'A4', part: 'A', q: 'Did you play another racket sport seriously?', sub: 'Tennis, table tennis, racquetball, badminton or squash.', opts: [['Yes', 0.25], ['No', 0]] },
    { id: 'C1', part: 'C', q: 'How do your serves usually go?', opts: [['I miss more than 1 in 5', 2.0], ['Almost always in, no particular target', 3.0], ['Consistently deep, in the back third of the court', 3.5], ['I vary depth, spin or speed on purpose', 4.25]] },
    { id: 'C2', part: 'C', q: 'How do your returns of serve usually go?', opts: [['I often miss or pop it up short', 2.5], ['Usually in, mostly to mid-court', 3.0], ["Usually deep, and I get to the kitchen line behind it", 3.75], ["Deep and placed to a target, and I'm at the line before the third shot", 4.5]] },
    { id: 'C3', part: 'C', q: 'When your team serves, what do you do with the third shot?', opts: [["Not sure what that is; I just hit it back", 2.0], ['I mostly drive it hard', 2.75], ['I try drops, but fewer than half land in the kitchen', 3.25], ['My drops land more than half the time', 3.75], ['I choose drop or drive based on the return, and it usually works', 4.5]] },
    { id: 'C4', part: 'C', q: 'What happens in a dink rally?', opts: [['I rarely dink or I avoid it', 2.5], ['A few dinks, then someone pops one up', 3.0], ['I can keep 10 or more dinks going, mostly straight ahead', 3.5], ['I dink cross-court and to feet on purpose, and wait for a ball to attack', 4.25], ['I move opponents with dinks and attack the first high ball', 4.75]] },
    { id: 'C5', part: 'C', q: 'When the ball comes fast at you at the net…', opts: [['I usually lose the point', 2.5], ['I can block soft ones; fast exchanges beat me', 3.0], ['I win some, and I can block to slow it down', 3.75], ['I counterattack and win most at my level', 4.5]] },
    { id: 'C6', part: 'C', q: 'Getting from the baseline to the kitchen line…', opts: [['I usually stay back', 2.5], ['I rush in and get hit at my feet or passed', 3.0], ['I move in step by step and sometimes reset a hard ball', 3.5], ['I can reliably reset hard drives into the kitchen', 4.25], ['I reset under pressure from anywhere', 4.75]] },
    { id: 'C7', part: 'C', q: 'How is your backhand?', opts: [['I run around it whenever I can', 2.5], ["I can hit it, but it's my weakness", 3.0], ['Reliable backhand dinks and volleys', 3.75], ['I can attack from my backhand', 4.5]] },
    { id: 'C8', part: 'C', q: "In a close game to 11, how many points do you lose on your own mistakes?", sub: "Count your own errors, not your opponents' great shots.", opts: [['More than 6', 2.5], ['4 to 6', 3.0], ['2 to 3', 3.75], ['0 to 1', 4.5]] },
    { id: 'C9', part: 'C', q: 'How do you and your partner move?', opts: [["I'm not sure where to stand beyond the basics", 2.5], ['We stay side by side most of the time', 3.25], ['We shift together toward the ball and call middle balls', 3.75], ['We stack, poach and adjust to the opponents', 4.5]] },
    { id: 'C10', part: 'C', q: 'How do you decide where to hit?', opts: [['I just get it back', 2.5], ['I hit hard whenever I can', 2.75], ['I aim at the weaker player or open space', 3.5], ['I attack only balls above net height, and aim at feet and hips', 4.25], ['I set up points over several shots', 4.75]] },
    { id: 'D1', part: 'D', q: 'What frustrates you most on court?', sub: 'Pick one.', opts: [['My serves miss or land short', 'C1'], ['My returns pop up or land short', 'C2'], ["I don't know what to do with the third shot", 'C3'], ['I lose dink rallies', 'C4'], ['I lose fast exchanges at the net', 'C5'], ['I get stuck or hit at my feet moving up', 'C6'], ['My backhand lets me down', 'C7'], ['When I make an easy mistake', 'C8'], ['My partner and I get out of position', 'C9'], ["I'm not sure where to hit", 'C10'], ['When I go for the wrong type of shot', 'C10']] },
    { id: 'D2', part: 'D', q: 'What do you want most from your game?', opts: [['Win more games', 'win'], ['Move up a level', 'level-up'], ['Play pain-free longer', 'pain-free'], ['Have more fun with my group', 'fun']] },
    { id: 'D3', part: 'D', q: 'How much practice time do you have outside of games?', opts: [['None', 0], ['1 session a week', 1], ['2 sessions a week', 2], ['3 or more a week', 3]] },
    { id: 'B1', part: 'B', q: 'Do you have a doubles DUPR rating?', sub: 'Optional. Pick a range, or skip if you don\'t have one.', exact: true, opts: [['No, or not sure', null], ['Under 3.0', 'u3'], ['3.0 to 3.49', '3.0'], ['3.5 to 3.99', '3.5'], ['4.0 to 4.49', '4.0'], ['4.5 or higher', '4.5']] },
    { id: 'B1b', part: 'B', q: 'Roughly how many rated matches is it based on?', when: s => s.B1 != null, opts: [['Under 10', '<10'], ['10 or more', '10+'], ['Not sure', '<10']] },
    { id: 'B2', part: 'B', q: 'Have you played in a tournament?', opts: [['Never', 'never'], ['Yes, no medal', 'played'], ['Yes, and I medaled', 'medal']] },
    { id: 'B2b', part: 'B', q: 'At what level was that tournament?', sub: 'Your most recent one.', when: s => s.B2 && s.B2 !== 'never', opts: LEVELS5 },
    { id: 'B3', part: 'B', q: 'At open play, which courts do you hold your own on?', opts: LEVELS5.concat([["Our courts aren't split by level", null]]) },
  ];

  const DUPR_VALUES = { u3: 2.75, '3.0': 3.25, '3.5': 3.75, '4.0': 4.25, '4.5': 4.75 };
  const visible = s => QUESTIONS.filter(q => !q.when || q.when(s));

  function toEngine(s) {
    const dupr = s.B1 == null ? null : { value: typeof s.B1 === 'number' ? s.B1 : DUPR_VALUES[s.B1], matches: s.B1b || '<10' };
    const tourney = !s.B2 || s.B2 === 'never' || s.B2b == null ? null : { level: s.B2b, medal: s.B2 === 'medal' };
    return { A2: s.A2, A3: s.A3, A4: s.A4, C1: s.C1, C2: s.C2, C3: s.C3, C4: s.C4, C5: s.C5, C6: s.C6, C7: s.C7, C8: s.C8, C9: s.C9, C10: s.C10,
      D1: s.D1, dupr, tourney, openPlay: s.B3 == null ? null : s.B3 };
  }

  // Returns a clean answers object holding only known questions and allowed values, or null if any shown question is missing or invalid.
  function clean(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const s = {};
    for (const q of QUESTIONS) {
      if (q.when && !q.when(s)) continue;
      if (!Object.prototype.hasOwnProperty.call(raw, q.id)) return null;
      const v = raw[q.id];
      const ok = q.opts.some(o => o[1] === v) || (q.exact && typeof v === 'number' && v >= 2 && v <= 8);
      if (!ok) return null;
      s[q.id] = q.exact && typeof v === 'number' ? Math.round(v * 100) / 100 : v;
    }
    return s;
  }

  const api = { PARTS, LEVELS5, QUESTIONS, visible, toEngine, clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Quiz = api;
})(this);
