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
  - `src/App.js`: all game state, money ladder, screen switching. Builds the run once on mount through `loadRun(settings)` (async, hard coded only for now, DB plugs in there in Phase 9b), holds `runStatus` (`loading` | `ready` | `too-few`) and `run`, question = `run[questionNumber - 1]`. Logs the run composition and each shown question to the console.
  - components: `Start` (name + button, gated on `runStatus`), `Quiz` (question, answers, lock button, music), `Timer` (effectively disabled), `GameOver`, `GameWinner`.
  - `src/services/dbQuestionService.js`: axios calls to `${REACT_APP_BASE_URL}/api/dbquestions`. Not imported anywhere since Phase 5, kept for Phase 9b.
  - `src/data/categories.json` and `src/data/questions.json`: category config (with the id `prefix` per category) and question pool (see Question model). Read by `src/lib/runBuilder.js`.
  - `src/lib/validateQuestion.js`: per-question checks (CommonJS, no dependencies), shared by the validator script and the game.
  - `src/lib/runBuilder.js`: pure run builder (CommonJS, no React). `getQuestionPool` (hard coded source: validated questions.json, unreviewed only per the Review rule), `getDefaultOptions`, `buildRun` (weighted allocation, sampling, difficulty sort, answer shuffle, returns `{ status, run, counts }`, never throws).
  - `scripts/test-run-builder.js`: logic tests for the run builder with a seeded random, run with `npm run test:logic`.
  - `scripts/validate-questions.js`: data validator, run with `npm run validate:questions` (add `-- --require-reviewed` for release). Uses `src/lib/validateQuestion.js` plus the file-level checks (categories, duplicate ids, summary table).
  - `src/questions.js`: old Finnish trivia (unused in game flow) and `prizeSums`.
  - `src/assets/*.mp3`: 7 music tracks.
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
Start screen asks for the name, has a Start button and a settings dropdown/panel. Defaults:
- Music: OFF (no audio before a user gesture)
- Practice mode: ON
- Sources: DB and Hard coded both checked
- Core categories on, extra categories off
- Weights editable per category, with a reset to defaults button
Settings are locked once a run starts. No persistence unless Leo asks for it.

Practice mode ON: a wrong answer does not end the run. Show the correct answer(s) and the explanation, continue to the next question, final result is a score out of 15. Practice mode OFF: classic behavior, a wrong answer ends the run (the old game has no safe checkpoints).

## Answer UI
- `single` and `truefalse`: clicking selects one answer (clicking another replaces it), the Lock button confirms (existing flow).
- `multiple`: toggle options, show "Select N answers" and a "Selected x/N" counter, do not allow more than N, the Lock button confirms.
- The Lock button is disabled until the selection is complete for every type (1 for `single`/`truefalse`, exactly N for `multiple`). This replaces the old alert.
- Lifelines: the old game has none. Out of the MVP. (If added later: 50:50 removes only wrong options, keeps all correct ones for `multiple`, disabled for `truefalse`.)
- Timer: stays disabled.
- Ladder: shows question numbers 1-15 instead of prize sums. No euro amounts anywhere.
- `src/questions.js` (old trivia and `prizeSums`) is deleted once nothing imports it.

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
Known temporary limitation: until Phase 6, the old Quiz.js accepts a single pick for every question type, so `multiple` questions are scored wrongly. Not fixed in Phase 5.
- [x] Hard coded source: load questions.json, validate at run time, use only reviewed questions in production, shuffle answers (except truefalse). Source chain structured so the optional DB source (Phase 9b) plugs in later.
- [x] Weighted category selection
- [x] Start button gating (loading bug fixed)

### Phase 6: Game UI logic
Must fix the Phase 5 limitation: Quiz.js still takes a single pick for every type, so `multiple` questions are scored wrongly until the `multiple` flow exists.
- [ ] `single`, `multiple` and `truefalse` answer flows
- [ ] Practice mode ON/OFF behavior and explanation display
- Temporary until the Phase 7 settings exist: the URL query `?practice=off` turns practice mode off (default ON). Removed in Phase 7.

### Phase 7: Start screen settings
- [ ] Settings panel with defaults (music OFF, practice ON, all sources checked)
- [ ] Source checkboxes (last one cannot be unchecked)
- [ ] Category toggles (extras off) and editable weights with reset
- [ ] Music toggle
- [ ] Fix music transitions: the track changes only after a click instead of when the question changes (audit: Quiz.js adds a one-time document click listener per round with no cleanup, and creates new Audio() on every render). Use one audio controller: start on a user gesture (Start click or music toggle), switch track when the question number changes, stop at the end of the game. Default OFF.

### Phase 8: Mobile
Audit findings (App.css has no @media rules at all):
- Money ladder sits beside the game at max-width 25% with nowrap and 25 px padding (App.css:32-47), overflows at 360 px
- `.answer` has min-width 200px plus 15 px margins (App.css:94-98), too wide for 6 options
- `.input-button-container` has a 10vh horizontal margin (App.css:231)
- `.game-over` is position absolute at 60% width (App.css:204-215)
- body font-size 22 px (public/index.html:20), timer circle 80 px (App.css:54-67)
- [ ] Verified at 360 px width, all screens and all question types
- [ ] Deploy the frontend alone as one Vercel project with Root Directory frontend (Leo, manual) once the game plays with hard coded questions and enough reviewed questions exist.

### Phase 9: Robustness tests (all must pass, also on the Vercel deployment)
- [ ] `REACT_APP_BASE_URL` unset: DB source skipped silently, game plays with hard coded questions
- [ ] Throttled network: Start waits, then the run works
- [ ] Full run for each question type with practice mode ON and OFF

### Phase 9b: Optional DB source and backend deployment
- [ ] New Atlas database and user, local backend .env created (Leo, manual)
- [ ] DB seed script (imports `frontend/src/data/questions.json`), DB seeded
- [ ] DB source: full collection loaded once per run build, client-side timeout (8 s), validation, top-up from hard coded
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
