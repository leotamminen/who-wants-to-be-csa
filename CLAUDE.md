# Who Wants to Be CSA Certified

Quiz game for ServiceNow CSA exam practice. Started as a plain copy (no shared git history) of the older Who-wants-to-be-an-engineer project. UI is done, the work is replacing content and data.

## Hard rules
- This repo is fully independent of the old project (leotamminen/Who-wants-to-be-an-engineer). Never touch, push to, or reference the old repo, its MongoDB, or its Vercel project.
- Never read or copy any old .env. Use only new credentials in local .env files.
- The only git remote is origin = leotamminen/who-wants-to-be-csa. Never add another.
- Never commit secrets. Keep .env, .env.local, .env.production and .vercel out of git.

## Goals
1. Audit the codebase: find all references to the old project name, DB/collection names, URLs and branding.
2. Rename everything to the CSA theme.
3. Replace engineering questions with ServiceNow CSA questions (keep the schema unless needed).
4. Keep changes minimal. Do not refactor working UI.

## Workflow
- Small commits with clear messages.
- Ask before adding dependencies.