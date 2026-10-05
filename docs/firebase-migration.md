# Firebase migration

Postgres is the running store. Firestore is a named driver that refuses work until this migration is implemented. Set `DATA_DRIVER=firestore` only after the methods below exist. Until then every call throws: "Firestore is not enabled. See docs/firebase-migration.md."

## What stays in git

The challenge catalog stays in `src/content`. Do not copy solutions, hints, anchors, or expected answers into Firestore. Skill node ids in the database are a mirror of the catalog so submissions can reference them. Positions and prerequisite edges can stay in git. User state moves.

## Method to collection

| ProgressStore method | Firestore |
| --- | --- |
| register / login | `users/{uid}` with `username`, `email`, `passwordHash`, `emailVerifiedAt`. Confirmation tokens live in `users/{uid}/verifications/{id}` (`tokenHash`, `expiresAt`, `usedAt`). Or use Firebase Auth and drop the password hash. |
| sessions | Prefer Firebase Auth session cookies. If you keep the table: `sessions/{tokenHash}` with `userId`, `expiresAt` |
| `masteredIds` | `users/{uid}/progress/{nodeId}` where `status == mastered` |
| `openAttempt` / `resetAttempt` | `users/{uid}/attempts/{attemptId}` with `nodeId`, `mode`, `startedAt`, `deadlineAt`, `hintsUsed`, `closedAt` |
| `revealHint` | Increment `hintsUsed` on the open attempt in a transaction |
| `recordSubmission` | Transaction: write `users/{uid}/submissions/{id}`, upsert progress, update `users/{uid}/stats`, update `users/{uid}/streak` |
| `dashboard` | Query submissions for the user, ordered by `submittedAt` |

Stats fields match Prisma: `overallElo`, `debuggingElo`, `securityElo`, `comprehensionElo`, `performanceElo`, `architectureElo`, `mlElo`, `totalChallengesSolved`. Streak fields: `currentStreak`, `longestStreak`, `lastActiveDate`, `streakFreezesLeft`.

Use the same `decideOutcome` rules. Do not re-derive mastery in the client.

## Rules sketch

```
match /users/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
  match /{document=**} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
}
```

That sketch is private-user data only. It is not a substitute for the grader. Grading has to stay on a trusted server because the catalog answers cannot be shipped to the client, and Firestore rules cannot run the sandbox. The Next.js route handlers stay. They swap `createStore()` to the Firestore implementation.

## Sandbox swap

Hosted multi-tenant runs set `SANDBOX_DRIVER=e2b` and implement `E2BSandbox.run` in `src/sandbox/run.ts`. The local permission sandbox stays the default for one developer on one machine. E2B currently throws on purpose.
