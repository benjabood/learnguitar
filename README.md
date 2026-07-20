# 🎸 90-Day Guitar — self-hosted daily practice trainer

A single-user, self-hosted website that teaches guitar from zero with **90 daily
~15-minute lessons**. The site opens to a calendar: click today, follow the steps,
watch the video, mark it done. Every 7th day is a lighter review day. Miss a day
and it counts as *behind*; do extra lessons and you get *ahead* — the header always
shows which. Record yourself during any lesson and the audio is stored on that day
so you can hear your progress week over week.

## Run it

```bash
npm install
npm start          # http://localhost:4321
```

Requires Node.js 20+ (built on Node 24). Set a different port with `PORT=8080 npm start`.

The first launch stamps **day 1 = today** into `data/state.json`. To restart the
whole 90-day program, stop the server and delete `data/state.json` (and
`data/recordings/` if you want the audio gone too).

## Features

- **Calendar home** — three months of lesson days: green = done, red = missed,
  outlined = today, 🔁 = review day, 🎙️ = has a recording.
- **Lessons** — step-by-step instructions with minute budgets, a practice
  countdown timer, generated chord/strum/tab charts, exactly one embedded
  YouTube lesson per day, and tips.
- **Date-anchored pacing** — days ahead / days behind in the header; complete
  any day's lesson to catch up or race ahead.
- **Achievements** — streaks (3→90 days), days-ahead, comeback-from-behind,
  recording milestones, review mastery, graduation.
- **Recordings** — record from the browser mic during any lesson; playback and
  delete from that day's page. Stored as files in `data/recordings/`.

## Layout

```
server.js             entry point
src/app.js            express app factory
src/routes/api.js     REST API (overview, lessons, complete, recordings)
src/lib/              schedule math, achievements, store, lessons, recordings
public/               no-build vanilla JS frontend
data/lessons/         the 90-day curriculum (week-01.json … week-13.json)
data/verified-videos.json  pool of oEmbed-verified YouTube videos
data/state.json       your progress (created at first run; gitignored)
data/recordings/      your practice audio (gitignored)
```

## Maintenance

```bash
npm test                 # unit + API + content validation (all 90 lessons)
npm run verify-videos    # re-check every YouTube link via oEmbed (link rot)
node scripts/validate-week.mjs data/lessons/week-05.json   # validate one file after editing
```

If `verify-videos` reports a dead link, pick a replacement, add it to
`data/verified-videos.json`, update the lesson's `youtube` block (title/channel
must match the pool entry exactly), and re-run `npm test`.

## Cloudflare deployment

The site also runs on Cloudflare Workers at
**https://learnguitar.benjabood.workers.dev** — same frontend, with a Worker
adapter (`workers/worker.js`) replacing the Express server:

- progress state lives in Workers KV (binding `STATE`, key `state`)
- recordings are stored as KV binary values under `rec:<filename>` keys
- "today" is computed in the visitor's timezone via `request.cf.timezone`

Redeploy after changes with `npx wrangler deploy`. Reset cloud progress with
`npx wrangler kv key delete --namespace-id ea07fe1ce9a948daaab1d65550d148b7 "state" --remote`.

⚠️ The workers.dev URL is public and the app has no auth — anyone with the link
can see and modify progress and recordings. Consider putting it behind
Cloudflare Access (Zero Trust → free for personal use) if that matters.

Note: local (`npm start`) and Cloudflare deployments keep **separate** progress.

## Notes

- Single user by design — no accounts, no auth. Don't expose it to the internet
  as-is; keep it on localhost or your LAN.
- Recordings upload cap is 25 MB per clip.
- Lesson "photos" are generated SVG chord charts, strumming patterns, and tabs —
  self-contained, no external image dependencies.
