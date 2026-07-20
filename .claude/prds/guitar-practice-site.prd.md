# Guitar Practice Site (90-Day Daily Trainer)

## Problem
Ben is a complete beginner who has tried to learn guitar before and stalled. Existing apps and courses didn't stick; what's missing is a fixed, low-friction structure — a calendar of small daily lessons — that makes "did I practice today?" a yes/no question. Left unsolved, the cost is another stalled attempt and a guitar gathering dust.

## Evidence
- Prior attempts to learn guitar stalled (user's own observed behavior, stated directly).
- The specific failed pattern was unstructured practice; the user is explicitly asking for calendar-driven 15-min/day pacing as the fix.
- n=1 personal tool — no further validation needed beyond the user's own history.

## Users
- **Primary**: Ben — complete beginner (starting from zero), self-hosting the site for himself, practicing ~15 minutes a day, sometimes more.
- **Not for**: Other learners, multi-user households, or public deployment. Single user by design.

## Hypothesis
We believe **a calendar-driven site with a 90-day curriculum of ~15-minute daily lessons (with photos, instructions, one YouTube link each, progress/streak feedback, and per-day audio recordings)** will **produce consistent practice and audible progress** for **a beginner who previously stalled without structure**.
We'll know we're right when **Ben practices ≥5 days/week for 8+ consecutive weeks and is still progressing through the curriculum**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Practice consistency | ≥5 lesson-days/week for 8+ weeks | Lesson completion dates stored by the site |
| Curriculum progress | Day 90 reached (ahead/behind within tolerance) | Days-ahead/behind indicator |
| Audible improvement | Recordings from week 1 vs. week 8 show clear improvement (self-judged) | Stored per-day audio recordings |

## Scope
**MVP** — the minimum to test the hypothesis:
- Calendar home page; click the current day to open that day's lesson
- 90 days of lesson content, fully authored up front (photos, written instructions, exactly one YouTube link per lesson), each sized to ~15 minutes; every 7th day is a lighter review day
- Ability to complete more than one lesson in a day to advance ahead of schedule
- Days-ahead / days-behind indicator
- Audio recording during a lesson, stored on that day's entry for later playback
- A small set of achievements (e.g., days-in-a-row streak, days ahead)
- Self-hosted, single user, no login/account complexity

**Out of scope**
- Multi-user accounts or profiles — single-user personal tool
- Mobile app — website only
- Automatic audio analysis or feedback — recordings are for self-review only
- Social/sharing features — no audience
- Payments/subscriptions — self-hosted and free
- Lesson authoring/admin UI — content is fully pre-authored; editing happens outside the site (deferred unless curriculum needs revisions in practice)

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Daily lesson loop | Open calendar, click today, take a complete lesson (photos, instructions, YouTube link), mark it done | complete | .claude/plans/guitar-practice-site.plan.md |
| 2 | 90-day curriculum | All 90 lessons authored and loaded — beginner-from-zero progression, each ~15 min | complete | .claude/plans/guitar-practice-site.plan.md |
| 3 | Pacing & motivation | Days ahead/behind visible; multi-lesson days advance schedule; streak and days-ahead achievements awarded | complete | .claude/plans/guitar-practice-site.plan.md |
| 4 | Progress recordings | Record audio during any lesson; playback from that day's calendar entry to compare over time | complete | .claude/plans/guitar-practice-site.plan.md |

## Decided
- [x] Missed days are **date-anchored**: skipped dates accumulate as "behind"; catching up means doing extra lessons, not shifting the schedule.
- [x] Curriculum shape: **every 7th day is a lighter review day** (12 review days + 78 progression days across the 90).
- [x] Lesson photos: **sourced when possible; generated (e.g., chord charts, hand-position diagrams) when sourcing fails.**

## Open Questions
- [ ] YouTube link rot over 90+ days — is a broken link acceptable until manually fixed, or should each lesson carry a fallback?
- [ ] Recording storage growth (daily audio for 90+ days) — any size/retention limit on the self-hosted box?

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Curriculum quality — content is AI-assembled, not from a guitar teacher; poor pedagogy could re-create the original stall | Medium | High | Anchor each day to a reputable YouTube lesson from established beginner curricula; keep lessons small; revise content if a week feels wrong |
| Motivation drop-off despite structure (the app can't make anyone practice) | Medium | High | Streaks/achievements, ahead/behind visibility, and audible-progress recordings are the built-in counters; 15-min sizing keeps the bar low |
| YouTube links break or videos are removed | Medium | Low | One link per lesson is easy to swap; treat as routine maintenance |
| Falling far behind makes the calendar demoralizing rather than motivating | Medium | Medium | Multi-lesson days allow catch-up; revisit missed-day semantics (open question) if it becomes a problem |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
