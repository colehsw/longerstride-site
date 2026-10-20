# longerstride.com

The Longer Stride website. Today it is one thing: the **Play Forever Level Check**, the free pickleball level quiz that signs players up for the **Play Forever Weekly** newsletter. More pages (the Club, products) get added here later.

- `public/`: the site. Plain HTML, CSS and JavaScript, no build step.
  - `index.html` + `app.js`: the quiz screens. Also served at `/level-check`.
  - `quiz.js`: the questions and answer checks (shared with the server).
  - `scoring.js`: the Level Check scoring engine. Don't rewrite it; change it only on purpose and rerun the tests.
  - `config.js`: public settings, including the Meta Pixel ID.
  - `privacy.html`: privacy page, at `/privacy`.
  - `og.png`: the picture shown when the link is shared on Facebook, iMessage and so on.
- `api/subscribe.js`: the email signup. It re-scores the answers on the server, then sends the player to Klaviyo.
- `tests/`: `npm test`.

## What happens when someone finishes the quiz

1. They see their level, their three skills to work on, and a 30-day plan right away.
2. The page sends their email, name, ZIP, answers and the ad they came from to `/api/subscribe`.
3. The server scores the answers again (so nobody can fake a level) and in Klaviyo:
   - creates or updates their profile with `lc_level`, `lc_level_range`, `lc_leak_1..3` (and `_id`), `lc_goal`, `lc_age_band`, `lc_practice_sessions`, `lc_utm_source`, `lc_utm_campaign` and the rest of the `lc_` fields;
   - subscribes them to the Play Forever Weekly list with email marketing consent, source "Level Check";
   - records a **Completed Level Check** event with the plan: `level`, `label`, and the plan as `week1_skill`, `week1_drill`, `week1_pass` through `week3_`.
4. If the Meta Pixel ID is set, the browser fires `Lead`, so Meta can optimize ads for signups.

## Go-live checklist

### 1. Klaviyo
1. Create a list named **Play Forever Weekly**. Copy its list ID (Audience > Lists > the list > Settings).
2. Create a private API key (Settings > API keys) with full access to **Profiles, Lists, Subscriptions and Events**.
3. Add your sending domain (Settings > Domains), for example `send.longerstride.com`, and put the DNS records it gives you into GoDaddy. Without this, emails land in spam.
4. Put the business mailing address in the email footer settings (the law requires one).
5. Build the welcome flow: trigger **Completed Level Check**. Email 1 goes right away with the plan. In the template, `{{ event.label }}` is the level line and `{{ event.week1_skill }}`, `{{ event.week1_drill }}`, `{{ event.week1_pass }}` are week 1 (`week2_` and `week3_` for the next two, sent a week apart).
6. For the Weekly's level-matched drill, make segments on `lc_level` (for example up to 3.0, 3.25 to 3.75, 4.0 and up).

### 2. Vercel
1. Import this repository as a new Vercel project. Framework: **Other**. Leave the build command empty.
2. Add the environment variables `KLAVIYO_PRIVATE_KEY` and `KLAVIYO_LIST_ID` (Project > Settings > Environment Variables). See `.env.example`.
3. Deploy, open the `.vercel.app` link, take the quiz with your own email, and check the profile and event show up in Klaviyo.

### 3. Domain (GoDaddy)
1. In Vercel, Project > Settings > Domains, add `longerstride.com` and `www.longerstride.com`.
2. In GoDaddy DNS, add the records Vercel shows. Usually an `A` record for `@` to `76.76.21.21` and a `CNAME` for `www` to `cname.vercel-dns.com`. Remove GoDaddy's parked-page records for `@` and `www` first.
3. Vercel issues the HTTPS certificate on its own once DNS points at it.

### 4. Meta
1. Create a Meta Pixel (Events Manager) for the Longer Stride ad account.
2. Put its ID in `public/config.js` (`metaPixelId`) and push.
3. Verify `longerstride.com` in Meta Business Settings > Brand Safety > Domains.
4. Tag every ad link with UTMs, for example `https://longerstride.com/?utm_source=meta&utm_medium=paid&utm_campaign=level-check-launch&utm_content=ad-name`. These land on the Klaviyo profile, so cost per subscriber and 30-day open rate can be split by ad.

### 5. Before sharing the link
- Make sure `hello@longerstride.com` receives mail (GoDaddy email forwarding is enough), since the privacy page lists it.

## Working on it
- `npm test`: scoring, answer checks and the Klaviyo mapping.
- `npm run preview`: local preview at http://localhost:3000 without Vercel. With no Klaviyo key set it fakes Klaviyo and prints what it would send. `PREVIEW_FAIL=1` shows the "couldn't save your email" state.
- `vercel dev` also works if you have the Vercel CLI.

Brand: Court Green `#1F3A2E` leads, Clubhouse Cream `#F5F3EC` ground, copper `#B87333` / `#D9A273` / `#9A5B2A` accents, Oxblood `#6E2A2A` labels, Rally Yellow `#D7E04F` for the ball only. Fraunces for headlines, DM Sans for text. Body text stays 18px or more and tap targets 48px or more, for players 50+.
