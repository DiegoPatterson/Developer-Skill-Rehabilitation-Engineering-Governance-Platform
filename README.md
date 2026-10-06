# Developer-Skill-Rehabilitation-Engineering-Governance-Platform

Developer Skill Rehabilitation & Engineering Governance is a practice platform for reading, patching, and reviewing code. The short name in the header is Skill Governance. Challenges are curated and executed. Nothing in this build is graded by a language model.

## Run locally

1. PostgreSQL listening on localhost port 5432, database `helmsman`, user `postgres`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` and a long random `SESSION_SECRET`.
3. `npm install`
4. `npm run db:generate`
5. `npm run db:push`
6. `npm run dev`
7. Open http://localhost:3000 and register.

Confirmation mail is sent from `strayapps.co@gmail.com`. In `.env`, set `SMTP_USER=strayapps.co@gmail.com` and `SMTP_PASS` to a Google app password for that mailbox. `MAIL_FROM` can stay as `Skill Governance <strayapps.co@gmail.com>`. Creating an account does not sign you in. Open the link, which lasts 24 hours, then sign in.

`npm test` runs the engine, catalog, sandbox, and scoring-rule tests.

The dev server copies a lesson from `src/content` into Postgres the first time that lesson has no saved payload. After that, the list and the tree read active rows from `skill_nodes`. Retiring a lesson hides it and leaves the row in place. User accounts, sessions, progress, and submissions stay in Postgres.

## What you practice

Six categories: debugging, security, comprehension, performance, architecture, and model selection. The tree view shows one category at a time. Each track starts on its own. A lesson unlocks only after every lesson that feeds it is mastered, including a lesson fed by two tracks. The outage is a 15-minute incident. It is not drawn on a tree.

Anyone signed in can propose a problem from Propose. It asks for a label, a name, a description, a track, a question type, starter code or the answer key that type needs, and optional prerequisites. An admin or owner accepts or rejects it from Review. Accepting assigns the next lesson number. New accounts are active users. An inactive or banned account cannot sign in. Refreshing the page does not reset its deadline. "Start a new incident" closes the open attempt and starts another clock.

## Scoring

A patch or incident score is `round(100 * (0.7 * correctness + 0.15 * performance + 0.15 * maintainability))`. Correctness is the share of functional tests that pass. Performance is 1 only when every scale bench passes. Each revealed hint subtracts 6 from the stored score on a patch or incident. Mastery needs every test to pass, a performance component of 1, a stored score of at least 70, and a submit inside the deadline when the node has one.

A late incident submit is capped at 60 and cannot master the node. It is still recorded.

Other kinds master on their own bar: trace and multiple choice when every answer matches, review at an F1 of 0.75, a spec at 80, leakage when the flagged set is exact, governance when every tool and gate matches, and the cost tradeoff only when the chosen option meets latency, budget, and accuracy.

ELO uses K=24 until that node is mastered and K=0 after. The opponent rating is `1000 + difficulty * 160`. An incident updates both debugging and security. Overall ELO is the mean of the six categories. Any submit counts as practice for the streak. Missed days spend shields. You can hold three. A new account starts with two. Every 7th day in a row earns one, up to that cap. A spent shield also returns on a later submit once 7 days have passed since the last shield was used. If missed days break the streak, shields refill to three.

Run checks the work and writes nothing. Submit writes the score, ELO, streak, and mastery. Debriefs and answer notes are returned only on submit.

## Sandbox

Patch and incident code runs in `sandbox/child.js` under `node --permission`, with the environment reduced to what the process needs to start, and with network APIs patched out. Node's permission model blocks the filesystem and child processes. It does not block the network, which is why the child patches those modules. `vm` is not a security boundary. This is an accident boundary for one person on one machine. A hosted multi-tenant deployment has to set `SANDBOX_DRIVER=e2b`. That driver throws until it is configured. See `docs/architecture.md`.

## Data

Active lessons live in Postgres `skill_nodes`, including the grader payload. `src/content` only seeds a lesson that is not stored yet. `DATA_DRIVER=firestore` selects a store whose methods throw and point at `docs/firebase-migration.md`.

Generated challenges are not wired. The later provider is SpaceXAI: set `XAI_API_KEY` on the server and call `https://api.x.ai/v1`. Do not put that key in the browser.

## Add a challenge

Add a seed object to `src/content/patch.ts`, `src/content/patch-rest.ts`, or `src/content/studio.ts` only for a lesson that is not already stored. Give it a unique id, prerequisites that already exist, and the next lesson number. Run `npm test`. The catalog test rejects a duplicate id, a missing prerequisite, a cycle, a reference patch that fails, and a starter that already passes. A lesson that already has a payload is left as the database has it, including whether it is on a tree and where it sits. Player-facing lessons are proposed and accepted, which writes the next row. Solutions, anchors, hint text, and expected answers stay off the public page. `toPublic` is the allowlist.
