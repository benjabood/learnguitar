# Plan: Guitar Practice Site (90-Day Daily Trainer)

**Source PRD**: .claude/prds/guitar-practice-site.prd.md
**Selected Milestone**: ALL (1–4) — user pre-confirmed full one-shot implementation
**Complexity**: Large

## Summary
Build a self-hosted, single-user website: a calendar of 90 daily ~15-minute guitar lessons (every 7th day is review), with photos/diagrams, one verified YouTube link per lesson, date-anchored ahead/behind tracking, streak/ahead achievements, and per-day audio recordings. Node.js + Express backend with JSON-file persistence, no-build vanilla JS frontend, Vitest tests for core logic.

## Patterns to Mirror
No existing code — the repository is empty except `.claude/`. No patterns exist to mirror; conventions below are established fresh and follow the user's global rules (small files, camelCase, immutable updates, explicit error handling).

## Architecture Decisions
- **Runtime**: Node 24 + Express. No build step, no native modules (Windows-safe, one-shot reliable).
- **Persistence**: `data/state.json` (atomic write via temp file + rename). Single user, low write volume — no DB needed.
- **Recordings**: browser MediaRecorder (webm/opus) → POST raw body → `data/recordings/day-NN-<timestamp>.webm`.
- **Photos**: generated SVG diagrams rendered client-side from structured specs (`chord`, `strum`, `tab`) — sourcing real licensed photos unattended is not reliable; PRD allows generated fallback.
- **YouTube links**: curated from established beginner channels; every video ID verified via YouTube oEmbed before inclusion. Content agents may only use verified IDs.
- **Date-anchored schedule**: curriculum day N ↔ startDate + N − 1. behind = past days incomplete; ahead = future days completed.

## Files to Change
| File | Action | Why |
|---|---|---|
| `package.json` | CREATE | express dependency, vitest + supertest dev deps, scripts |
| `server.js` | CREATE | Express app entry (listen), thin |
| `src/app.js` | CREATE | Express app factory (testable without listening) |
| `src/routes/api.js` | CREATE | REST endpoints: state, lessons, complete, recordings |
| `src/lib/store.js` | CREATE | JSON state persistence, atomic writes, immutable updates |
| `src/lib/schedule.js` | CREATE | date-anchored pacing: expected day, ahead/behind, streaks |
| `src/lib/achievements.js` | CREATE | achievement definitions + evaluation |
| `src/lib/lessons.js` | CREATE | load + validate lesson content files |
| `data/lessons/week-01..13.json` | CREATE | 90 lessons of authored content (parallel agents) |
| `data/verified-videos.json` | CREATE | oEmbed-verified YouTube link pool |
| `public/index.html` | CREATE | SPA shell |
| `public/css/style.css` | CREATE | styling (calendar, lesson, achievements) |
| `public/js/app.js` | CREATE | router/bootstrap |
| `public/js/views/calendar.js` | CREATE | month calendar, day states, header stats |
| `public/js/views/lesson.js` | CREATE | lesson page: steps, diagrams, YouTube, timer, recorder |
| `public/js/views/achievements.js` | CREATE | achievements panel |
| `public/js/diagrams.js` | CREATE | SVG renderer for chord/strum/tab specs |
| `public/js/recorder.js` | CREATE | MediaRecorder wrapper |
| `public/js/api.js` | CREATE | fetch client |
| `test/schedule.test.js` | CREATE | pacing/streak unit tests (TDD) |
| `test/achievements.test.js` | CREATE | achievement unit tests (TDD) |
| `test/store.test.js` | CREATE | persistence tests |
| `test/api.test.js` | CREATE | supertest integration tests |
| `test/lessons.test.js` | CREATE | content schema validation across all 90 days |
| `scripts/verify-videos.mjs` | CREATE | oEmbed check for every YouTube ID in content |
| `README.md` | CREATE | run/host instructions |

## Tasks
### Task 1: Scaffold + core logic (TDD)
- **Action**: package.json, tests for schedule/achievements/store first, then implement libs.
- **Validate**: `npm test` — RED then GREEN.

### Task 2: Verify YouTube link pool
- **Action**: curate ~50 beginner videos (JustinGuitar, Andy Guitar, Marty Music, etc.); verify each via `https://www.youtube.com/oembed?url=...`; write `data/verified-videos.json` with only passing IDs.
- **Validate**: `node scripts/verify-videos.mjs` exits 0, every pool entry verified.

### Task 3: Author 90-day curriculum (parallel agents)
- **Action**: 4–5 parallel agents, each authoring 2–3 weeks of lessons to a strict JSON schema, using ONLY verified video IDs; every 7th day is review; each lesson ~15 min of steps with diagram specs.
- **Validate**: `test/lessons.test.js` — 90 days present, schema-valid, review days at day % 7 === 0, all video IDs ∈ verified pool.

### Task 4: API + server
- **Action**: routes for state/lessons/complete/recordings with input validation and explicit error handling; recording upload size cap.
- **Validate**: `npm test` (supertest suite).

### Task 5: Frontend
- **Action**: calendar view (ahead/behind header, day states incl. review-day marker), lesson view (steps, SVG diagrams, YouTube embed + link, 15-min timer, recorder, per-day recording playback, complete button), achievements panel with unlock states.
- **Validate**: server starts; page loads; HTTP smoke checks (and browser if available).

### Task 6: Review + polish
- **Action**: run code-reviewer agent; fix CRITICAL/HIGH findings; README.
- **Validate**: review returns no CRITICAL.

## Validation
```bash
npm test                       # all unit + integration tests
node scripts/verify-videos.mjs # every YouTube link resolves via oEmbed
npm start                      # server boots; GET / returns 200
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Bad/removed YouTube IDs | Medium | oEmbed verification gate; content agents restricted to verified pool |
| Content agents drift from schema | Medium | Strict JSON schema + validation test over all 90 days; fix or regenerate failures |
| MediaRecorder codec differences per browser | Low | Accept any audio/* mime, store with correct extension |
| oEmbed blocked from this network | Low | Fall back to WebFetch verification; else mark links TBD in README |

## Acceptance
- [ ] All tasks complete
- [ ] `npm test` green (90-lesson content validation included)
- [ ] Every lesson has ≥1 diagram, instructions summing ~15 min, exactly 1 verified YouTube link
- [ ] Calendar shows ahead/behind; multi-lesson catch-up works; achievements unlock; recordings save + play back
