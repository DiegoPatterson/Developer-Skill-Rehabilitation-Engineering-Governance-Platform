# Architecture

Skill Governance is a Next.js app. The catalog is TypeScript in git. User state is Postgres through Prisma. Two drivers are seams only: Firestore for user state, and E2B for untrusted code.

## Request path

`src/proxy.ts` only looks at the `sg_session` cookie. A missing cookie sends `/graph`, `/dashboard`, `/account`, `/outage`, and `/challenge/*` to `/login`. A present cookie sends `/login` and `/register` to `/graph`. Pages and route handlers load the session from Postgres and reject an expired or unknown token. The cookie is httpOnly, SameSite=Lax, 30 days, and `Secure` only when the request is HTTPS.

Register and login hash the password with bcrypt (cost 10). The session row stores the SHA-256 of a 32-byte token. The raw token is the cookie value.

## Catalog and public data

`createSource()` returns the curated catalog. `toPublic` / `toWorkspace` are the only shapes sent to the browser. They omit solutions, hint bodies, review anchors, expected answers, leak flags, and the string `REFERENCE_SOLUTION`. Hint text is returned one step at a time from `POST /api/hint`, counted on the open attempt.

A workspace attempt is created the first time the page opens and reused until the node is mastered or, for an incident, until "Start a new incident" closes it. `timeToFix` is submit time minus `startedAt`.

## Grading

`POST /api/grade` with `mode: "run"` evaluates and returns pass/fail without debriefs or expected answers. `mode: "submit"` evaluates with reveal on, then `PrismaProgressStore.recordSubmission` applies the hint penalty, the late cap, mastery, ELO, and the streak inside one transaction. The rules live in `src/server/outcome.ts` and `src/engine`.

Patch and incident code goes through `LocalPermissionSandbox` unless `SANDBOX_DRIVER=e2b`. The child process is `node --permission --allow-fs-read=<child.js>`, with `DATABASE_URL` and the rest of the app environment removed. Network constructors are replaced because Node 22 permissions do not deny them. A wall-clock kill stops a synchronous loop. Treat this as a local accident boundary. Do not point it at other tenants.

## ELO, streak, graph

Opponent rating is `1000 + difficulty * 160`. K is 24 before the node is mastered and 0 after. An incident updates debugging and security. Overall is the mean of the six category ratings. The streak uses the server's local calendar day. Dates are stored as UTC midnight of that day and read back with UTC getters.

The graph reads positions and prerequisites from the catalog. Status is mastered, locked, or in progress. Locked means a prerequisite is not mastered. The incident node has `showInGraph: false` and is always open.

## Later providers

SpaceXAI is the provider for a future generator. The key is `XAI_API_KEY`. The base URL is `https://api.x.ai/v1`. Keep the key on the server. This build does not call the API and does not substitute a fake completion. `ChallengeSource` is the place a generator would plug in. The curated list stays the default until a generator is tested against the same grader.

`DATA_DRIVER=firestore` constructs `FirestoreStore`, which throws. `SANDBOX_DRIVER=e2b` constructs `E2BSandbox`, which throws. The catalog still lives in git either way.
