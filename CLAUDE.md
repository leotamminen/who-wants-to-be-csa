# Who Wants to Be CSA Certified

ServiceNow CSA exam practice game in "Who Wants to Be a Millionaire" style. Started as a plain copy (no shared git history) of the older Who-wants-to-be-an-engineer project. The UI is mostly reused. The work is new content, question logic and start screen settings.

**Definition of done:** a fully working CSA quiz that never breaks in a demo. If the database fails, the game still plays with hard coded questions and the player notices nothing. No AI API is used in the MVP (see Phase 12).

## Hard rules
- This repo is fully independent of the old project (leotamminen/Who-wants-to-be-an-engineer). Never touch, push to, or reference the old repo, its MongoDB, or its Vercel project.
- Never read or copy any old .env. Use only new credentials in local .env files.
- The only git remote is origin = leotamminen/who-wants-to-be-csa. Never add another.
- Never commit secrets. Keep .env, .env.local, .env.production and .vercel out of git. Only .env.example (names, no values) is committed.
- No AI API in the MVP. If an AI feature is added later, its key lives in backend env only, never in frontend code or REACT_APP_ variables (they end up in the public bundle).
- Account work (Atlas, Vercel, env vars, GitHub settings) is done by Leo manually. Give exact steps and wait for confirmation. Do not attempt it.

## Working agreement
- Follow the checklist below in order, one phase at a time, small commits.
- After each feature is finished, update this file in the same commit: tick the box and add one line to the Progress log.
- If a feature is skipped or fails, leave it unticked and log why: what was tried, what blocked, what is needed.
- Do not guess. If the schema, behavior or a decision is unclear, ask Leo.
- Ask before adding dependencies.
- Keep UI changes minimal. Only change what the features below require. Do not refactor working UI.

## Architecture (names from the initial file list, verify in audit)
- backend: app.js, server.js, controllers/apiAIQuestionGenerator.js (Gemini), controllers/dbController.js (MongoDB), controllers/apiController.js, models/question.js, vercel.json. server_old.js looks unused, confirm before removing.
- frontend (React): src/questions.js (hard coded), src/services/apiQuestionService.js, src/services/dbQuestionService.js, components Start, Quiz, Timer, GameOver, GameWinner.
- The AI path (controllers/apiAIQuestionGenerator.js, controllers/apiController.js, src/services/apiQuestionService.js) is inherited from the old game and is not part of the MVP. Take it out of the game flow and settings. Do not delete the files until Leo approves (the audit proposes keep or delete).

## Question model
Keep existing fields (difficulty etc). Add:
- `category`: one of the category ids in the weights config.
- `type`: `single` | `multiple` | `truefalse`.
- `correct`: array of option indexes (a legacy single answer maps to `type: single`, `correct: [i]`).
- `explanation`: optional short text, shown in practice mode after answering.

Rules per type:
- `single`: 4 options, exactly 1 correct. Behaves like the old game.
- `multiple`: 5-6 options, N correct (N >= 2). UI states "Select N".
- `truefalse`: 2 options, 1 correct.
Scoring is all or nothing. Multiple answer is wrong unless the selection is exactly the correct set.

## Categories and weights
- One config file holds categories, default weights, and an `extra` flag. Weights must be easy to edit.
- Core categories follow the official CSA exam blueprint. Known so far: Platform Overview and Navigation 7%, Instance Configuration 10%. **The remaining domains and weights must be filled from the current official ServiceNow CSA exam specification. Do not invent them. Ask Leo if the spec is not available.**
- Extra categories (for fun, e.g. ITIL/ITSM concepts, ServiceNow trivia) have `extra: true`, are off by default and can be toggled on.
- Selection for a run of 15 questions: allocate per category by weight (largest remainder rounding) among enabled categories, renormalized. If a category pool has too few questions, redistribute the remainder to other enabled categories. Keep the old difficulty progression if the old game had one.

## Question sources and fallback chain
Sources in priority order: DB (MongoDB via backend), Hard coded (frontend bundle, always available). No AI source in the MVP.
- The DB source has a timeout (start with 8 s, Vercel and Atlas cold starts can be slow). A failure or timeout moves on silently to hard coded.
- Validate every returned question against the schema. Drop invalid ones.
- Fill the run from the DB first and top up from hard coded. Hard coded is the last resort and is synchronous.
- The user can uncheck a source in settings, but the last enabled source cannot be unchecked. If only DB is enabled and it fails, hard coded is used anyway.
- The player never sees an error about sources. Log to the browser console which source served each question (`console.warn` on failures).
- Single source of truth for question content (e.g. one questions JSON file). The DB seed script imports from it so DB and hard coded stay in sync.
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

Practice mode ON: a wrong answer does not end the run. Show the correct answer(s) and the explanation, continue to the next question, final result is a score out of 15. Practice mode OFF: classic behavior, a wrong answer ends the run (keep any existing safe checkpoints).

## Answer UI
- `single`: click selects and locks, as before.
- `multiple`: toggle options, show a "Selected x/N" counter, do not allow more than N, Confirm button enabled only when exactly N are selected.
- `truefalse`: two large buttons.
- Lifelines, if the old game has them, must work with all types. 50:50 removes only wrong options (for `multiple` it keeps all correct ones) and is disabled for `truefalse`.

## Debug logging
Keep the console logging of questions and correct answers as a dev aid. It stays in production but is not advertised in the UI.

## Responsive
Works on a phone at 360 px width: no horizontal scroll, tap targets at least 44 px, 6-option layout fits, settings panel usable.

## Content quality
- Write original questions. No exam dump or braindump material.
- Verify facts against official ServiceNow documentation. Add a short explanation to each question.

## Env and deployment (Leo does the account steps)
- New Atlas database and user for this project only, new Vercel project(s) from this repo, CORS updated for the new domain.
- Env var names come from the audit, listed in .env.example. Expect at least a Mongo URI and a frontend API base URL. No AI key in the MVP.

## Checklist

### Phase 0: Setup
- [x] New repo, history detached from the old project, pushed to origin
- [x] CLAUDE.md added
- [ ] Claude Code installed in VS Code (Leo)

### Phase 1: Audit (read only, no edits)
- [ ] List every reference to the old project: names, URLs, DB and collection names, env vars, package.json fields, README
- [ ] Document how questions are stored, loaded and used, the current schema, lifelines, difficulty logic, env var names, and where the loading bug comes from
- [ ] Check whether Mongo is used for anything besides questions (e.g. high scores)
- [ ] Check how frontend and backend are deployed on Vercel
- [ ] Propose how to take the AI path out of the game flow (keep or delete the files)
- [ ] Propose a change list and wait for Leo's approval

### Phase 2: Rename and cleanup
- [ ] Rename package names, titles, README, URLs, DB and collection names to the CSA theme
- [ ] Add .env.example, verify gitignores cover all env files
- [ ] Remove or justify unused files (e.g. server_old.js)

### Phase 3: Infrastructure (Leo, manual)
- [ ] New Atlas database and user, local backend .env created
- [ ] New Vercel project(s), env vars set, CORS updated

### Phase 4: Data model and content base
- [ ] Schema updated (category, type, correct[], explanation) with legacy compatibility
- [ ] Categories and weights config from the official blueprint
- [ ] Shared question file and initial hard coded pool
- [ ] DB seed script, DB seeded

### Phase 5: Loading logic
- [ ] Source chain with timeouts, validation and top-up
- [ ] Weighted category selection
- [ ] Start button gating (loading bug fixed)

### Phase 6: Game UI logic
- [ ] `single`, `multiple` and `truefalse` answer flows
- [ ] Practice mode ON/OFF behavior and explanation display
- [ ] Lifelines compatible with all types

### Phase 7: Start screen settings
- [ ] Settings panel with defaults (music OFF, practice ON, all sources checked)
- [ ] Source checkboxes (last one cannot be unchecked)
- [ ] Category toggles (extras off) and editable weights with reset
- [ ] Music toggle

### Phase 8: Mobile
- [ ] Verified at 360 px width, all screens and all question types

### Phase 9: Robustness tests (all must pass, also on the Vercel deployment)
- [ ] Backend down: game plays with hard coded questions
- [ ] Bad DB connection: hard coded used, no visible error
- [ ] DB slower than the timeout: hard coded used after the timeout
- [ ] Each source alone checked works
- [ ] Throttled network: Start waits, then the run works
- [ ] Full run for each question type with practice mode ON and OFF

### Phase 10: Content
- [ ] Hard coded pool filled and verified against official docs
- [ ] DB reseeded from the same source file

### Phase 11: Release
- [ ] README updated
- [ ] Production deployment verified
- [ ] Old repo archived (Leo, manually, last)

### Phase 12: Post-MVP extras (optional, only when Leo asks)
- [ ] AI feature, e.g. AI explains or evaluates a wrong answer, or AI-generated questions. The game must work fully without it and the fallback guarantee must not change. Leo approves the provider first. The key stays in backend env only.
- [ ] Other extras Leo decides on

## Progress log
Format: `YYYY-MM-DD: what was done` or `YYYY-MM-DD: SKIPPED what, why`
- 2026-09-30: New repo created, history detached from old project, CLAUDE.md added.
- 2026-09-30: Decision: AI/Gemini is out of the MVP. Sources are DB and hard coded. AI moved to Phase 12 (post-MVP extras).