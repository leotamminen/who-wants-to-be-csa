# Who Wants to Be CSA Certified

ServiceNow CSA exam practice game in "Who Wants to Be a Millionaire" style. Started as a plain copy (no shared git history) of the older Who-wants-to-be-an-engineer project. The UI is mostly reused. The work is new content, question logic and start screen settings.

**Definition of done:** a fully working CSA quiz that never breaks in a demo. If the database fails, the game still plays with hard coded questions and the player notices nothing. No AI API is used in the MVP (see Phase 12).

## Hard rules
- This repo is fully independent of the old project (leotamminen/Who-wants-to-be-an-engineer). Never touch, push to, or reference the old repo, its MongoDB, or its Vercel project.
- The one allowed reference to the old project is the attribution link in README.md:3. It is intentional. Renames and cleanups leave it alone.
- Never read or copy any old .env. Use only new credentials in local .env files.
- The only git remote is origin = leotamminen/who-wants-to-be-csa. Never add another.
- Never commit secrets. Keep .env, .env.local, .env.production and .vercel out of git. Only .env.example (names, no values) is committed.
- Frontend env vars are public (they end up in the bundle). Never put secrets in frontend files. frontend/.env.development stays tracked because it holds no secrets.
- No AI API in the MVP. If an AI feature is added later, its key lives in backend env only, never in frontend code or REACT_APP_ variables (they end up in the public bundle).
- Account work (Atlas, Vercel, env vars, GitHub settings) is done by Leo manually. Give exact steps and wait for confirmation. Do not attempt it.

## Working agreement
- Follow the checklist below in order, one phase at a time, small commits.
- After each feature is finished, update this file in the same commit: tick the box and add one line to the Progress log.
- If a feature is skipped or fails, leave it unticked and log why: what was tried, what blocked, what is needed.
- Do not guess. If the schema, behavior or a decision is unclear, ask Leo.
- Ask before adding dependencies.
- Keep UI changes minimal. Only change what the features below require. Do not refactor working UI.

## Architecture (first audited in Phase 1, current state after the Phase 3 code changes)
- Deployment: two Vercel projects from this repo. Backend project with Root Directory `backend`, frontend project with Root Directory `frontend`. The backend no longer serves the frontend build.
- backend (Express + Mongoose), Vercel zero-config Express, no `vercel.json`:
  - `app.js`: requires express, Mongo connect, `cors()` open to all origins (to be restricted to the frontend URL once it exists), `express.json()`, route `/api/dbquestions`, 404 and error middleware, `module.exports = app`. This is what Vercel runs. No static serving.
  - `server.js`: local development only (`npm start`, `npm run dev`), `http.createServer(app).listen(PORT || 3001)`.
  - `controllers/dbController.js`: `GET /` all questions, `GET /:difficulty` one random question of that difficulty. No try/catch.
  - `models/question.js`: Mongoose model `Question` (collection `questions`).
  - `utils/config.js` (dotenv, PORT, MONGODB_URI), `utils/logger.js` (console wrappers), `utils/middleware.js` (unknownEndpoint, errorHandler).
- frontend (Create React App, React 18):
  - `src/App.js`: all game state, ladder (question numbers 15 to 1), screen switching, the `.question-progress` label ("Question N / 15", shown by CSS below 700 px instead of the ladder), `settings` (from `getDefaultSettings`, practice mode read from it) and `score`. Rebuilds the run when `settings.enabled` or `settings.weights` change, and computes the Start message (settings problem or "Not enough questions for these settings"). Builds the run once on mount through `loadRun(settings)` (async, hard coded only for now, DB plugs in there in Phase 9b), holds `runStatus` (`loading` | `ready` | `too-few`) and `run`, question = `run[questionNumber - 1]`. Logs the run composition and each shown question to the console.
  - components: `Start` (name + button gated on `runStatus` and the message, collapsed `<details>` settings panel), `Quiz` (question, answers, lock button, no audio; selection is an array of answer indexes handled by `src/lib/answerLogic.js`, reveal after 3 s, next step after 1 more s), `Timer` (disabled and not rendered since Phase 7, file kept), `GameOver` ("You reached question N"), `GameWinner` (classic win, or "Practice complete" with "Score: X / 15" and the play-again link when given a score).
  - `src/services/dbQuestionService.js`: axios calls to `${REACT_APP_BASE_URL}/api/dbquestions`. Not imported anywhere since Phase 5, kept for Phase 9b.
  - `src/data/categories.json` and `src/data/questions.json`: category config (with the id `prefix` per category) and question pool (see Question model). Read by `src/lib/runBuilder.js`.
  - `src/lib/validateQuestion.js`: per-question checks (CommonJS, no dependencies), shared by the validator script and the game.
  - `src/lib/runBuilder.js`: pure run builder (CommonJS, no React). `getQuestionPool` (hard coded source: validated questions.json, unreviewed only per the Review rule), `getDefaultOptions`, `buildRun` (weighted allocation, sampling, difficulty sort, answer shuffle, returns `{ status, run, counts }`, never throws).
  - `src/lib/answerLogic.js`: pure answer rules (CommonJS, no React): `getCorrectIndexes`, `getRequiredCount`, `toggleSelection`, `canLock`, `isCorrect` (exact set), `getAnswerStates` (correct/wrong/neutral for the reveal). A selection is an array of answer indexes.
  - `src/lib/musicTracks.js`: `getTrackKey(questionNumber)` (track per question, same mapping as the old Quiz.js) and `WIN_TRACK_KEY`.
  - `src/hooks/useBackgroundMusic.js`: `useBackgroundMusic({ enabled, questionNumber, phase })`, phase `idle` | `playing` | `won` | `over`. One Audio object per track, created once on first play. Switches track when the key for the current state changes, pauses and rewinds the others, ignores rejected play() calls. App derives the phase from name, timeOut and isFinished.
  - `src/lib/settingsLogic.js`: pure settings rules (CommonJS, no React): `getDefaultSettings`, `setWeight` (integer 0-100, garbage becomes 0), `setEnabled`, `setFlag`, `getShares` (whole percent among participating categories), `getSettingsProblem`. The settings object `{ practiceMode, musicOn, enabled, weights }` is passed to `buildRun` as is.
  - `scripts/test-run-builder.js`, `scripts/test-answer-logic.js`, `scripts/test-settings-logic.js` and `scripts/test-music-tracks.js`: logic tests (node:assert, no dependencies), all run with `npm run test:logic`.
  - `scripts/validate-questions.js`: data validator, run with `npm run validate:questions` (add `-- --require-reviewed` for release). Uses `src/lib/validateQuestion.js` plus the file-level checks (categories, duplicate ids, summary table).
  - `src/assets/*.mp3`: 7 music tracks, played by `useBackgroundMusic`.
  - `frontend/.env.development` is tracked and contains only `DANGEROUSLY_DISABLE_HOST_CHECK=true` (harmless).
- Env vars read by code: backend `PORT`, `MONGODB_URI`; frontend `REACT_APP_BASE_URL`, `REACT_APP_ALLOW_UNREVIEWED` (see Review rule). Listed in `backend/.env.example` and `frontend/.env.example`.
- MongoDB is used only for questions (no scores or users).
- Frontend finds the API via `REACT_APP_BASE_URL`, which must point to the backend (backend Vercel URL in production, e.g. `http://localhost:3001` locally). Relative URLs no longer work because nothing serves frontend and API from the same origin, and there is no CRA proxy.
- The AI path was deleted in Phase 2.

## Question model
Questions live in `frontend/src/data/questions.json` (single source of truth). Each question has these fields:
- `id`: string, unique, 3-letter category prefix + 3 digits, e.g. `dbm-001`. The prefix must equal the `prefix` of the question's category in categories.json: `pon` platform-overview, `ins` instance-configuration, `col` collaboration, `ssa` self-service-automation, `dbm` database-management, `dmi` data-migration-integration, `ext` extra.
- `category`: an id from `frontend/src/data/categories.json`.
- `type`: `single` | `multiple` | `truefalse`.
- `difficulty`: integer 1-3. The round number is no longer the difficulty.
- `question`: string.
- `answers`: array of `{ text, correct: boolean }`. Correct answers are flagged per answer row, not as an index array, because indexes break when answers are added or shuffled.
- `explanation`: string, required, shown in practice mode after answering.
- `reviewed`: boolean, see the review rule.

Rules per type:
- `single`: 4 answers, exactly 1 correct.
- `multiple`: 5-6 answers, 2 or more correct and at least 1 wrong. The number N in "Select N" is the number of correct answers, it is not stored.
- `truefalse`: exactly the answers "True" and "False", 1 correct.

Answers are shuffled at run time, except `truefalse`. Scoring stays all or nothing: a multiple answer is wrong unless the selection is exactly the correct set.

`npm run validate:questions` (in frontend) checks the data files against these rules.

## Review rule
- Only questions with `reviewed: true` are used in production builds (`NODE_ENV=production`). Unreviewed questions are used when `NODE_ENV !== "production"` or when `REACT_APP_ALLOW_UNREVIEWED === "true"`, so the game can be tested with placeholders.
- `REACT_APP_ALLOW_UNREVIEWED` is a public frontend env var (not a secret), listed in frontend/.env.example with an empty value. The production Vercel project must not set it unless Leo decides to preview placeholders.
- Only Leo sets `reviewed` to true, after checking the facts against the official ServiceNow documentation. Claude may draft questions or placeholders but never sets `reviewed: true`.
- Placeholders must be visibly fake: the question text starts with "[PLACEHOLDER]" and answers read like "Placeholder answer A". Never write plausible-looking ServiceNow facts that nobody has checked.

## Categories and weights
- `frontend/src/data/categories.json` holds `{ id, prefix, name, weight, extra }` per category. Weights must be easy to edit.
- Core categories and weights, taken from Leo's exam specification. Verify them against the current official ServiceNow CSA blueprint before release. The six core weights sum to 100.

  | id | name | weight |
  |---|---|---|
  | platform-overview | Platform Overview and Navigation | 7 |
  | instance-configuration | Instance Configuration | 10 |
  | collaboration | Configuring Applications for Collaboration | 20 |
  | self-service-automation | Self Service & Automation | 20 |
  | database-management | Database Management and Platform Security | 30 |
  | data-migration-integration | Data Migration and Integration | 13 |

- Extra category: id `extra`, name "Extra (for fun)", default weight 10, `extra: true`, off by default, can be toggled on. The name is a placeholder, Leo decides the content later.
- Weights are renormalized among the enabled categories.
- Selection for a run of 15 questions: allocate per category by weight (largest remainder rounding) among enabled categories. If a category pool has too few questions, redistribute the remainder to other enabled categories. Then sort the 15 by ascending difficulty (1-3). The whole run is built before the game starts. There is no per-round fetching.

## Question sources and fallback chain
Sources: Hard coded (frontend bundle, always available) and DB (MongoDB via backend, optional). No AI source in the MVP.
- Hard coded is built first and is enough for a fully working game. The DB source is optional and is built last (Phase 9b).
- If `REACT_APP_BASE_URL` is unset, the DB source is skipped silently, so the frontend can be deployed alone.
- The DB source loads the full collection once per run build (one request, not per round). It has a client-side timeout (start with 8 s, Vercel and Atlas cold starts can be slow). A failure or timeout moves on silently to hard coded.
- Validate every question against the schema, from any source. Drop invalid ones.
- When the DB source is available, fill the run from the DB first and top up from hard coded. Hard coded is the last resort and is synchronous.
- The user can uncheck a source in settings, but the last enabled source cannot be unchecked. The Sources section in settings (Phase 7) is hidden while `REACT_APP_BASE_URL` is unset, because only one source exists then. If only DB is enabled and it fails, hard coded is used anyway.
- The player never sees an error about sources. Log to the browser console which source served each question (`console.warn` on failures).
- Single source of truth for question content: `frontend/src/data/questions.json`. The DB seed script imports from it so DB and hard coded stay in sync.
- Hard coded pool: at least 5 questions per core category to start, target 45+ total, so runs vary.

## Loading bug fix
The old game loaded questions in the background while the player typed a name, so a fast player started with no questions. Fix: the Start button is disabled with a "Loading questions..." state until the question set for the run is complete (sources resolved or timed out and the fallback applied). The name field stays usable meanwhile. Reload the set when source, category or weight settings change.

## Start screen and settings
Start screen asks for the name, has a Start button and a settings panel. Settings live in App state, no persistence unless Leo asks for it. Defaults:
- Music: OFF (no audio before a user gesture)
- Practice mode: ON
- Core categories on, extra categories off
- Weights: the defaults from categories.json
- Sources: DB and Hard coded both checked (Sources section only from Phase 9b, see below)

The settings panel is a collapsed `<details>` "Settings" below the Start button. It is locked by design, because the start screen is gone once the run starts. Contents:
- Practice mode checkbox, Music checkbox
- One row per category: enabled checkbox, name, integer weight 0-100, effective share in percent among the participating categories (enabled, weight > 0, questions in the pool), number of questions available in the pool
- "Reset to defaults" button

The Sources checkboxes are not built in Phase 7, because only one source exists. They come in Phase 9b and are shown only when `REACT_APP_BASE_URL` is set.

The run is rebuilt when category or weight settings change, not when only music or practice mode change. Start is disabled with a short message when the settings cannot build a run.

Music: one hook (`useBackgroundMusic`), tracks per question number as in the old Quiz.js, the track switches when the question number changes (not on the next click). Starts only after the Start click (user gesture), plays the win track after a win or practice completion, stops at game over. Toggle only in settings, no mid-game mute.

Practice mode ON: a wrong answer does not end the run. Show the correct answer(s) and the explanation, continue to the next question, final result is a score out of 15. Practice mode OFF: classic behavior, a wrong answer ends the run (the old game has no safe checkpoints).

## Answer UI
- `single` and `truefalse`: clicking selects one answer (clicking another replaces it), the Lock button confirms (existing flow).
- `multiple`: toggle options, show "Select N answers" and a "Selected x/N" counter, do not allow more than N, the Lock button confirms.
- The Lock button is disabled until the selection is complete for every type (1 for `single`/`truefalse`, exactly N for `multiple`). This replaces the old alert.
- Lifelines: the old game has none. Out of the MVP. (If added later: 50:50 removes only wrong options, keeps all correct ones for `multiple`, disabled for `truefalse`.)
- Timer: stays disabled. The timer circle is hidden from Phase 7 on (Timer.js is kept but not rendered).
- Ladder: shows question numbers 1-15 instead of prize sums. No euro amounts anywhere.
- `src/questions.js` (old trivia and `prizeSums`) was deleted in Phase 6.

## Debug logging
Whenever a question is shown, log its id, category and correct answer(s) to the console, plus which source served it. This is a dev aid. It stays in production but is not advertised in the UI.

## Responsive
Works on a phone at 360 px width: no horizontal scroll, tap targets at least 44 px, 6-option layout fits, settings panel usable.

## Content quality
- Write original questions. No exam dump or braindump material.
- Verify facts against official ServiceNow documentation. Add a short explanation to each question.

## Env and deployment (Leo does the account steps)
- First: the frontend alone as one Vercel project (Root Directory `frontend`), once the game plays with hard coded questions. `REACT_APP_BASE_URL` stays unset, so the DB source is skipped.
- Optional, later (Phase 9b): new Atlas database and user for this project only, backend Vercel project (Root Directory `backend`), CORS restricted to the frontend domain.
- Env var names come from the audit, listed in .env.example. Expect at least a Mongo URI and a frontend API base URL. No AI key in the MVP.

## Checklist

### Phase 0: Setup
- [x] New repo, history detached from the old project, pushed to origin
- [x] CLAUDE.md added
- [x] Claude Code installed in VS Code (Leo)

### Phase 1: Audit (read only, no edits)
- [x] List every reference to the old project: names, URLs, DB and collection names, env vars, package.json fields, README
- [x] Document how questions are stored, loaded and used, the current schema, lifelines, difficulty logic, env var names, and where the loading bug comes from
- [x] Check whether Mongo is used for anything besides questions (e.g. high scores)
- [x] Check how frontend and backend are deployed on Vercel
- [x] Propose how to take the AI path out of the game flow (keep or delete the files)
- [x] Propose a change list and wait for Leo's approval

### Phase 2: Rename and cleanup
- [x] Remove the Mongo URI logging in backend/app.js:14 (it prints credentials to the logs)
- [x] Remove the deploy:full script
- [x] Delete the AI path: apiController.js, apiAIQuestionGenerator.js, apiQuestionService.js, the /api/apiquestions route, config.API_KEY, the Google dependencies
- [x] Delete server_old.js and the root package-lock.json
- [x] Remove unused dependencies (backend: agent-base, @google-ai/generativelanguage, google-auth-library; frontend: dotenv, web-vitals, @testing-library/*), dead imports (Question in apiController.js, earnedMoney in GameOver.js) and commented-out code (Quiz.js). @vercel/node kept, see Phase 3.
- [x] Extend .gitignore files: backend gets `.env.*` (followed by `!.env.example` so the example stays committed) and `build`; frontend gets `.env.production` only (frontend/.env.development stays tracked)
- [x] Rename package names, titles, README (except the attribution link), URLs, DB and collection names to the CSA theme (index.html title/description, Start.js heading/placeholder, GameWinner.js text, dbController.js comment, model/collection name)
- [x] Add .env.example, verify gitignores cover all env files

### Phase 3: Infrastructure (Leo, manual)
- [x] Decide one Vercel project (backend serves frontend) vs two (separate frontend and backend). Decision: two projects.
- [x] After that decision: remove the build:ui script and express.static("build") in backend/app.js (or keep them if one project is chosen) (Claude, after Leo's decision)
- [x] Check what current Vercel docs require for the Express backend (server.js calls listen() and does not export the app; vercel.json uses the legacy builds config). Decide whether the @vercel/node dependency in backend/package.json is still needed or can be removed. Result: zero-config Express runs app.js, vercel.json and @vercel/node removed.
- Open account items (Atlas, Vercel projects, CORS) moved to Phase 9b.

### Phase 4: Data model and content base
- [x] Data files: `frontend/src/data/categories.json` (seven categories) and `frontend/src/data/questions.json` (schema above)
- [x] Validator: `frontend/scripts/validate-questions.js` (plain Node) and `npm run validate:questions`, with `--require-reviewed` for release
- [x] Placeholders: at least 5 questions per core category and 3 in extra, all types and difficulties 1-3 mixed, all `reviewed: false`

### Phase 5: Loading logic
Known temporary limitation (fixed in Phase 6): until Phase 6, the old Quiz.js accepted a single pick for every question type, so `multiple` questions were scored wrongly.
- [x] Hard coded source: load questions.json, validate at run time, use only reviewed questions in production, shuffle answers (except truefalse). Source chain structured so the optional DB source (Phase 9b) plugs in later.
- [x] Weighted category selection
- [x] Start button gating (loading bug fixed)

### Phase 6: Game UI logic
The Phase 5 limitation (single pick for every type) is fixed by the answer flows below.
- [x] `single`, `multiple` and `truefalse` answer flows
- [x] Practice mode ON/OFF behavior and explanation display
- Temporary until the Phase 7 settings exist: the URL query `?practice=off` turns practice mode off (default ON). Removed in Phase 7, practice mode comes from the settings panel.

### Phase 7: Start screen settings
- [x] Settings panel with defaults (music OFF, practice ON, core categories on, extra off)
- [x] Category toggles (extras off) and editable weights with reset
- [x] Music toggle
- [x] Fix music transitions: the track changes only after a click instead of when the question changes (audit: Quiz.js adds a one-time document click listener per round with no cleanup, and creates new Audio() on every render). Use one audio controller: start on a user gesture (Start click or music toggle), switch track when the question number changes, stop at the end of the game. Default OFF.

### Phase 8: Mobile
Target: usable at 360 px width and not broken at 320 px. No horizontal scrolling on any screen, tap targets at least 44 px high, readable text, all question types incl. 6 answers fit (vertical page scroll is fine). Screens: start screen with the settings panel open, question (single, multiple with 6 answers, truefalse), explanation box with the Next button, GameOver, GameWinner and the practice end screen. Desktop look unchanged above 700 px. CSS-first, the only JS change is the progress label.

Rules:
- Breakpoint 700 px.
- Below 700 px the ladder is hidden and a "Question N / 15" label (`.question-progress`) is shown above the question instead.
- Answers: one column, full width, min-height 48 px, font size with clamp().
- Hover effects only under `@media (hover: hover)`, so taps do not leave a stuck hover state.
- Inputs use font-size 16 px or more (iOS zooms smaller inputs).
- Use dvh with a vh fallback wherever 100vh is used.
- Replace the fixed values from the Phase 1 audit: ladder at max-width 25% with nowrap and 25 px padding, `.answer` min-width 200 px plus margins, `.input-button-container` 10vh horizontal margin, `.game-over` absolute at 60% width, fixed body font size 22 px, fixed circle sizes.

Layout cannot be verified by automated tests. Leo checks each screen at 360 px and 320 px in DevTools device mode, and later on a real phone (including iOS Safari for the music).

- [x] Fluid layout: fixed widths, margins and absolute positioning replaced, body font size with clamp()
- [x] Below 700 px: one column, ladder hidden, progress label, full width answers and buttons (min-height 48 px)
- [x] Start screen and settings table fit 320 px (category rows wrap)
- [x] Hover effects only under `@media (hover: hover)`
- [ ] Verified at 360 px width, all screens and all question types
- [ ] Deploy the frontend alone as one Vercel project with Root Directory frontend (Leo, manual) once the game plays with hard coded questions and enough reviewed questions exist.

### Phase 8b: Timer (optional setting)
Not implemented in Phase 8. Decisions:
- Settings: a "Timer" checkbox, default OFF and independent of practice mode, plus a seconds input (integer 10-300, default 60) that is enabled only when the timer is on. Reset to defaults resets both. Both go into settingsLogic with tests.
- Behavior: the timer counts down per question from the moment it is shown, stops when Lock is pressed and restarts for the next question. At 0 the question counts as wrong, with no partial credit: practice mode reveals the correct answers and the explanation and waits for Next, classic mode ends the game.
- The circle shows the seconds left and is hidden when the timer is off. Timer.js is rewritten (the old one resets to 6000 s and ignores the lock state). The circle must fit the Phase 8 mobile layout.
- [ ] Settings logic and tests
- [ ] Timer component and timeout handling
- [ ] Mobile check

### Phase 9: Robustness tests (all must pass, also on the Vercel deployment)
- [ ] `REACT_APP_BASE_URL` unset: DB source skipped silently, game plays with hard coded questions
- [ ] Throttled network: Start waits, then the run works
- [ ] Full run for each question type with practice mode ON and OFF

### Phase 9b: Optional DB source and backend deployment
- [ ] New Atlas database and user, local backend .env created (Leo, manual)
- [ ] DB seed script (imports `frontend/src/data/questions.json`), DB seeded
- [ ] DB source: full collection loaded once per run build, client-side timeout (8 s), validation, top-up from hard coded
- [ ] Source checkboxes in the settings panel (last one cannot be unchecked), shown only when `REACT_APP_BASE_URL` is set (moved from Phase 7)
- [ ] New backend Vercel project (Root Directory backend), env vars set, `REACT_APP_BASE_URL` set on the frontend project (Leo, manual)
- [ ] CORS restricted to the frontend URL (Claude, after the URL exists)
- [ ] Test: backend down, game plays with hard coded questions
- [ ] Test: bad DB connection, hard coded used, no visible error
- [ ] Test: DB slower than the timeout, hard coded used after the timeout
- [ ] Test: each source alone checked works
- [ ] DB reseeded from questions.json after content changes

### Phase 10: Content
- [ ] Leo writes real questions and sets `reviewed: true` after checking the facts against the official ServiceNow documentation
- [ ] `npm run validate:questions -- --require-reviewed` passes

### Phase 11: Release
- [ ] README updated
- [ ] Production deployment verified
- [ ] Rotate the old project's Atlas password (its backend logged the full Mongo URI to the Vercel logs) (Leo, manually)
- [ ] Old repo archived (Leo, manually, last)

### Phase 12: Post-MVP extras (optional, only when Leo asks)
- [ ] AI feature, e.g. AI explains or evaluates a wrong answer, or AI-generated questions. The game must work fully without it and the fallback guarantee must not change. Leo approves the provider first. The key stays in backend env only.
- [ ] Other extras Leo decides on
- [ ] Lifelines (50:50 etc.), out of the MVP since the Phase 1 decision. Rules in the Answer UI section apply if added.
- [ ] Polish, low priority, do last: better answer-select and lock sounds and animations

## Progress log
Format: `YYYY-MM-DD: what was done` or `YYYY-MM-DD: SKIPPED what, why`
- 2026-09-30: New repo created, history detached from old project, CLAUDE.md added.
- 2026-09-30: Decision: AI/Gemini is out of the MVP. Sources are DB and hard coded. AI moved to Phase 12 (post-MVP extras).
- 2026-09-30: Phase 1 audit done and approved. Decisions: delete AI path in Phase 2; add category/type/correct[]/difficulty 1-3; run built up front and sorted by difficulty; DB optional, loaded once with client timeout; no lifelines, timer disabled, ladder shows 1-15; console logs id, category, correct answers.
- 2026-09-30: Removed unused deps (backend: agent-base, @google-ai/generativelanguage, google-auth-library; frontend: dotenv, web-vitals, @testing-library/*), the earnedMoney dead import and the commented-out code in Quiz.js. Kept @vercel/node for the Phase 3 vercel.json check. Build and node --check pass.
- 2026-09-30: .gitignore extended. Backend: .env.*, !.env.example, build. Frontend: .env.production. Verified with git check-ignore: .env.example and frontend/.env.development stay unignored, and no tracked file is ignored.
- 2026-09-30: CSA rename done: page title/description, Start heading/placeholder, GameWinner text; Mongoose model QuestionsCollection renamed to Question (collection "questions"). Added backend/.env.example (MONGODB_URI, PORT) and frontend/.env.example (REACT_APP_BASE_URL). git ls-files shows only frontend/.env.development and the two .env.example files tracked. Build and node --check pass. Phase 2 complete.
- 2026-09-30: Phase 3 decision: two Vercel projects (Root Directory backend and frontend). Per current Vercel docs, Express runs zero-config from app.js (requires express, module.exports = app). Removed express.static("build") and the build:ui script, deleted vercel.json, uninstalled @vercel/node. server.js kept for local dev. cors() stays open until the frontend URL exists. Architecture section updated. node --check and build pass.
- 2026-09-30: Plan change: hard coded questions first, DB source optional and last. New question schema (per-answer correct flags, explanation required, reviewed flag), review rule (only reviewed questions in production, only Leo sets reviewed), six core categories and weights from Leo's exam spec plus an extra category. Open Phase 3 account items, the DB seed script, the DB source and the DB robustness tests moved to the new Phase 9b. Phase 4 and Phase 10 rewritten.
- 2026-09-30: Phase 4 done. Added categories.json (6 core + extra), questions.json (the 3 real entries from Leo, still unreviewed, plus 30 visible placeholders: 5 per core category, 3 extra, all types and difficulties) and validate-questions.js with npm run validate:questions. Validator passes (33 questions). --require-reviewed fails as expected (0 reviewed). All error checks were tested against a broken copy in a temp folder.
- 2026-09-30: Shared validation: categories.json gets a `prefix` per category, per-question checks moved to src/lib/validateQuestion.js (used by validate-questions.js), new check that the id prefix matches the category prefix. Validator output and exit codes unchanged. Decisions recorded: Sources section hidden while REACT_APP_BASE_URL is unset, REACT_APP_ALLOW_UNREVIEWED, multiple scored wrongly until Phase 6, prefix mapping in categories.json.
- 2026-09-30: Run builder added (src/lib/runBuilder.js): hard coded pool with validation and review filter, slot-by-slot weighted allocation (largest remainder, redistributes when a category runs out), sampling without replacement, ascending difficulty, answer shuffle except truefalse, source "hardcoded". scripts/test-run-builder.js (npm run test:logic, seeded mulberry32): 17/17 pass. Not wired into the game yet.
- 2026-09-30: Phase 5 done. App.js builds the run once on mount via async loadRun (StrictMode-safe cancel flag), per-round dbQuestionService fetch and its import removed, question = run[questionNumber - 1]. Console logs run composition once and id/category/type/correct/source per shown question. Start button and Enter do nothing until runStatus is "ready" ("Loading questions..." while loading, "Question pool is not ready yet" when too-few, which production shows while nothing is reviewed). Small .username-button:disabled style added. validate:questions, test:logic (17/17), node --check and build pass. Build still has 3 pre-existing eslint warnings in Quiz.js and Timer.js, which fail a CI=true build (Vercel) and need fixing before the Phase 8 deploy.
- 2026-09-30: SKIPPED Phase 6 item "Lifelines compatible with all types": lifelines are out of the MVP since the Phase 1 decision (the old game has none). Moved to Phase 12.
- 2026-09-30: Phase 6 plan recorded: Lock button disabled until the selection is complete (replaces the alert), single/truefalse select-then-lock, temporary ?practice=off until Phase 7, ladder 1-15 with no euro amounts, src/questions.js deleted once unused. Phase 7 gets the music transition fix, Phase 12 gets lifelines and sound/animation polish.
- 2026-09-30: Answer logic added (src/lib/answerLogic.js) with scripts/test-answer-logic.js covering all three types: replace/toggle, limit N, canLock, exact set vs subset/superset/different set, reveal states incl. missed correct answers, no mutation. test:logic runs both files: 17/17 and 11/11 pass. Not wired into Quiz.js yet.
- 2026-09-30: Answer flows done in Quiz.js: selection as index array via answerLogic (click replaces for single/truefalse, toggle with limit N for multiple), "Select N answers. Selected x/N" line for multiple, Lock disabled until canLock (alert removed), selected answers orange for 3 s, then every answer revealed (correct incl. missed, incorrect for wrong picks), classic flow kept. The 4 s correct/incorrect keyframes were replaced by static colours, because the 3 s wait now shows as "active". End of run moved from render into an App.js effect. One "Locked: [...] -> correct|wrong" log. The 3 old lint warnings are fixed (eslint-disable on the audio effect deps until the Phase 7 rewrite). validate:questions, test:logic (17/17, 11/11), node --check and CI=true build pass with no warnings.
- 2026-09-30: Phase 6 done. Practice mode (default ON, temporary ?practice=off until Phase 7): after the reveal an .explanation box ("Correct!"/"Wrong." plus the explanation) and a Next button, no auto advance, wrong answers do not end the run, end screen "Practice complete" with "Score: X / 15" and the play-again link (GameWinner with props). Classic mode unchanged. Score counted at each reveal. Ladder shows 15..1, GameOver says "You reached question N", earnedMoney removed, src/questions.js deleted (nothing imported it). validate:questions, test:logic (17/17, 11/11), node --check and CI=true build pass with no lint warnings.
- 2026-09-30: Phase 7 plan recorded: settings in App state without persistence, collapsed <details> Settings panel (practice, music, per category enabled/weight 0-100/share/pool count, reset), run rebuilt only on category/weight changes, timer circle hidden, ?practice=off removed, one music hook switching tracks on question change. Source checkboxes moved to Phase 9b (only one source exists, shown only when REACT_APP_BASE_URL is set).
- 2026-09-30: Settings logic added (src/lib/settingsLogic.js) with scripts/test-settings-logic.js: defaults, weight parsing/clamping/NaN, immutability, shares (sum close to 100, excluded categories 0), each problem message, and buildRun giving identical runs with the full settings object and with only { enabled, weights }. test:logic runs all three suites: 17/17, 11/11, 12/12 pass. Not wired into the UI yet.
- 2026-09-30: Settings panel done: collapsed <details> Settings below Start with practice and music checkboxes, per category row (enabled, name, weight 0-100, share %, pool count) and Reset to defaults (resets all settings). Settings in App state, ?practice=off removed. The run is rebuilt (runStatus "loading") only when enabled or weights change, with the cancel flag. Start disabled with the getSettingsProblem message or "Not enough questions for these settings". Timer circle hidden: Timer only set timeOut at 0, otherwise timeOut is set true only by the wrong-answer path in Quiz. App's unused answersLocked state removed. Console logs the category settings and shares per run build, practice/music at Start. All checks pass, CI=true build without warnings. Music toggle is stored but not played until the music commit.
- 2026-09-30: Phase 7 done. Music moved out of Quiz.js (audio imports, per-render Audio objects, document click listeners and the eslint-disable removed) into src/hooks/useBackgroundMusic.js with the mapping in src/lib/musicTracks.js (tests: scripts/test-music-tracks.js, 3/3). Track switches on question change, win track after a win or practice completion, silence on the start screen, at game over and with music off. Toggle only in settings, default OFF. Checked the hook with a fake Audio in a scratch script. validate:questions, test:logic (17/17, 11/11, 12/12, 3/3), node --check and CI=true build pass without warnings.
- 2026-10-02: Phase 8 rules recorded: breakpoint 700 px, ladder hidden and "Question N / 15" label below it, one-column answers min-height 48 px with clamp() font, hover only under (hover: hover), inputs 16 px or more, dvh with vh fallback. Layout is checked manually by Leo at 360/320 px and on a real phone. New Phase 8b (optional timer setting) planned, not implemented.
- 2026-10-02: Phase 8 layout implemented (not yet verified in a browser, Leo checks 360/320 px). index.html: viewport meta already correct, body font clamp(16px, 10px + 1.75vw, 22px). App.css: ladder padding clamp, nowrap removed; .answer min-width min(200px, 100%); .game-over in the page flow, width 90% max 840 px; .input-button-container side margin clamp(16px, 8vw, 90px); timer circle clamp() sizes; hover rules under (hover: hover). Below 700 px: ladder and timer container hidden, .question-progress label (only JS change, App.js), one-column answers min-height 48 px with clamp() font, Lock/Next full width min-height 48 px, explanation and question full width, start screen full width with 48 px inputs, settings rows wrap (name line, then checkbox 24 px, weight 4.5rem, share and question count with CSS labels), number inputs 16 px, overflow-wrap anywhere. Remaining large values are max-width caps or vertical margins. No 100vh in the code. All checks pass, CI=true build without warnings.
