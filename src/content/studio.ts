import type { Challenge } from "./types";

const routeSource = `function route(req) {
  if (!req) {
    return "drop";
    req.logged = true;
  }
  if (req.cache && req.cache.hit) return "cache";
  let status = "miss";
  if (req.role === "admin") {
    status = "admin";
  } else if (!req.token) {
    return "deny";
  }
  if (status === "admin" || req.token === "ok") return "allow";
  return "deny";
}
`;

const refundReview = `async function issueRefund(store, session, payment, amount, key) {
  const current = await store.read(payment.accountId);
  await store.write(payment.accountId, current + amount);
  ledger.push({ paymentId: payment.id, amount, actor: session.userId });
  return { ok: true };
}
`;

const authReview = `async function loadUser(db, id) {
  try {
    return await db.user(id);
  } catch (err) {
    return { id, status: "ok" };
  }
}
`;

const notesReview = `function renderNote(note) {
  return '<div class="note">' + note.body + "</div>";
}
`;

const agentRefund = `async function postRefund(req) {
  try {
    console.log("refund card", req.body.cardNumber);
    const amount = req.body.amount;
    await db.insert("refunds", { amount, cardNumber: req.body.cardNumber });
    return { ok: true };
  } catch (error) {
    return { ok: true };
  }
}

async function deleteAllUsers() {
  await db.query("DELETE FROM users");
  return { ok: true };
}
`;

export const studioChallenges: Challenge[] = [
  {
    id: "comp-trace",
    title: "Say the state",
    category: "comprehension",
    difficulty: 1,
    summary: "Write the variables at three points before you run anything.",
    showInGraph: true,
    prereqs: ["dbg-state-basics"],
    x: 280,
    y: 180,
    kind: "trace",
    signature: "function score(xs)",
    traceCode: `function score(xs) {
  let best = 0;
  let used = 0;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] < 0) continue;
    used += 1;
    if (xs[i] > best) best = xs[i];
  }
  return best + used;
}
`,
    brief: [
      { type: "p", text: "The input is [3, -1, 3, 10]. Fill the variables after the named iterations finish, and the return value. A continue does not increment used. An equal value does not replace best." },
    ],
    constraints: ["Answers are digits, such as 3.", "Iteration indexes are the values of i."],
    hints: ["The negative value is skipped, so used does not change on that pass.", "The second 3 is not greater than best."],
    debrief: [{ type: "p", text: "After i=0, best is 3 and used is 1. i=1 continues. i=2 sees another 3, so used becomes 2 and best stays 3. i=3 sets best to 10 and used to 3. The return is 13." }],
    checkpoints: [
      { id: "i0.best", prompt: "best after i = 0", answer: "3" },
      { id: "i0.used", prompt: "used after i = 0", answer: "1" },
      { id: "i1.best", prompt: "best after i = 1", answer: "3" },
      { id: "i1.used", prompt: "used after i = 1", answer: "1" },
      { id: "i3.best", prompt: "best after i = 3", answer: "10" },
      { id: "i3.used", prompt: "used after i = 3", answer: "3" },
      { id: "return", prompt: "return value", answer: "13" },
    ],
  },
  {
    id: "comp-cfg",
    title: "Read the control flow",
    category: "comprehension",
    difficulty: 3,
    summary: "The graph is built from the function. Answer from the branches, not from a run.",
    showInGraph: true,
    prereqs: ["comp-trace"],
    x: 560,
    y: 280,
    kind: "choice",
    signature: "function route(req)",
    cfgSource: routeSource,
    brief: [
      { type: "p", text: "The right panel is the control-flow graph of route. Edges labeled true and false leave each condition. A statement drawn after a return in the same block is unreachable." },
    ],
    constraints: ["Pick one answer per question.", "Mastery is every question."],
    hints: [],
    debrief: [{ type: "p", text: "The cache hit returns before role is read. A user with no token returns deny from the else-if. The assignment after return \"drop\" has no incoming live edge." }],
    questions: [
      {
        id: "cache",
        prompt: "What does route return for { cache: { hit: true }, role: \"admin\" }?",
        options: [
          { id: "cache", label: "cache" },
          { id: "allow", label: "allow" },
          { id: "admin", label: "admin" },
          { id: "drop", label: "drop" },
        ],
        answer: "cache",
        explanation: "The cache condition returns before the admin branch is reached.",
      },
      {
        id: "user",
        prompt: "What does route return for { role: \"user\" }?",
        options: [
          { id: "deny", label: "deny" },
          { id: "allow", label: "allow" },
          { id: "drop", label: "drop" },
          { id: "miss", label: "miss" },
        ],
        answer: "deny",
        explanation: "There is no token, so the else-if returns deny.",
      },
      {
        id: "dead",
        prompt: "Which statement is unreachable?",
        options: [
          { id: "logged", label: "req.logged = true" },
          { id: "drop", label: "return \"drop\"" },
          { id: "allow", label: "return \"allow\"" },
        ],
        answer: "logged",
        explanation: "It sits after return \"drop\" in the same block, so no live edge reaches it.",
      },
    ],
  },
  {
    id: "comp-pr-review",
    title: "Review the refund PR",
    category: "comprehension",
    difficulty: 4,
    summary: "Comment the race, the missing idempotency key, the swallowed error, and the HTML concatenation.",
    showInGraph: true,
    prereqs: ["comp-cfg", "sec-injection"],
    x: 840,
    y: 340,
    kind: "review",
    signature: "Comments on refund.js, auth.js, and notes.js",
    brief: [
      { type: "p", text: "You are reviewing a three-file change. Leave a comment on a line near each real defect. A comment counts when the file, the category, and a line within three of the defect agree, and the text is at least 8 characters." },
      { type: "p", text: "Categories: race, validation, exception, injection. Extra comments lower precision. Mastery needs an F1 of at least 0.75." },
    ],
    constraints: ["Do not rewrite the files. The review is the work.", "One comment can match only one finding."],
    hints: [],
    debrief: [{ type: "p", text: "The refund writes a stale balance, ignores key, the catch returns a fake user, and the note is concatenated into HTML." }],
    categories: ["race", "validation", "exception", "injection"],
    reviewFiles: [
      { name: "refund.js", content: refundReview },
      { name: "auth.js", content: authReview },
      { name: "notes.js", content: notesReview },
    ],
    findings: [
      { file: "refund.js", anchor: "await store.write(payment.accountId, current + amount)", category: "race", tolerance: 3, summary: "The refund reads a balance and writes it back, so two refunds can lose an update." },
      { file: "refund.js", anchor: "async function issueRefund", category: "validation", tolerance: 3, summary: "key is unused, so a retry refunds again." },
      { file: "auth.js", anchor: 'return { id, status: "ok" }', category: "exception", tolerance: 3, summary: "The catch swallows the failure and returns a success-shaped user." },
      { file: "notes.js", anchor: "note.body", category: "injection", tolerance: 2, summary: "The note body is concatenated into HTML." },
    ],
  },
  {
    id: "perf-complexity",
    title: "Name the complexity",
    category: "performance",
    difficulty: 2,
    summary: "Worst-case time, from the code, without running it.",
    showInGraph: true,
    prereqs: ["dbg-boundaries"],
    x: 560,
    y: 140,
    kind: "choice",
    signature: "Four snippets",
    brief: [{ type: "p", text: "Pick the worst-case time. Map lookups are average O(1). Sorting a copy is O(n log n). Concatenating onto a growing array copies the array each time." }],
    constraints: ["Mastery is all four.", "Space is not being asked."],
    hints: [],
    debrief: [{ type: "p", text: "The pair scan is quadratic. The sort dominates the unique pass. A Map get is constant on average. Repeated concat copies every element so far, which sums to quadratic." }],
    questions: [
      {
        id: "pairs",
        prompt: "Worst-case time of hasPair.",
        code: `function hasPair(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i !== j && nums[i] + nums[j] === target) return true;
    }
  }
  return false;
}`,
        options: [
          { id: "n2", label: "O(n^2)" },
          { id: "nlogn", label: "O(n log n)" },
          { id: "n", label: "O(n)" },
          { id: "1", label: "O(1)" },
        ],
        answer: "n2",
        explanation: "Every index is compared with every index.",
      },
      {
        id: "sort",
        prompt: "Worst-case time of uniqueSorted.",
        code: `function uniqueSorted(nums) {
  const copy = nums.slice().sort((a, b) => a - b);
  const out = [];
  for (const n of copy) if (out[out.length - 1] !== n) out.push(n);
  return out;
}`,
        options: [
          { id: "nlogn", label: "O(n log n)" },
          { id: "n2", label: "O(n^2)" },
          { id: "n", label: "O(n)" },
          { id: "1", label: "O(1)" },
        ],
        answer: "nlogn",
        explanation: "The sort sets the bound. The scan after it is linear.",
      },
      {
        id: "map",
        prompt: "Average time of first.",
        code: `function first(map, key) {
  return map.get(key) ?? null;
}`,
        options: [
          { id: "1", label: "O(1)" },
          { id: "n", label: "O(n)" },
          { id: "nlogn", label: "O(n log n)" },
          { id: "n2", label: "O(n^2)" },
        ],
        answer: "1",
        explanation: "A hash map get is constant on average.",
      },
      {
        id: "concat",
        prompt: "Worst-case time of grow.",
        code: `function grow(n) {
  let rows = [];
  for (let i = 0; i < n; i++) rows = rows.concat([i]);
  return rows;
}`,
        options: [
          { id: "n2", label: "O(n^2)" },
          { id: "n", label: "O(n)" },
          { id: "nlogn", label: "O(n log n)" },
          { id: "1", label: "O(1)" },
        ],
        answer: "n2",
        explanation: "concat copies the whole array on every iteration. The copies sum to about n^2 / 2.",
      },
    ],
  },
  {
    id: "arch-spec",
    title: "Spec before code",
    category: "architecture",
    difficulty: 4,
    summary: "Write the flag-evaluation contract. The rubric is deterministic.",
    showInGraph: true,
    prereqs: ["comp-pr-review"],
    x: 1120,
    y: 340,
    kind: "spec",
    signature: "A short spec for mobile flag evaluation",
    brief: [
      { type: "p", text: "A mobile client needs to ask, for one user, which boolean flags are on. Flags have a key and a default. Some users are in a segment. When the flag is missing, the client must receive the default. Do not design user administration." },
      { type: "p", text: "The score is a rubric: summary, non-goals, a GET evaluate-or-flag endpoint, auth named as bearer, api key, or session, errors 400 and 401, a Flag entity with key and default, a rule or segment or condition, and an acceptance note that a missing flag returns the default. A DELETE of users costs 20 points. Mastery is 80." },
    ],
    constraints: ["Write the contract, not the implementation.", "Empty sections score zero for that check."],
    hints: [],
    debrief: [{ type: "p", text: "The useful spec is the one an agent can be checked against later: the endpoint, the auth, the missing-flag default, and an explicit non-goal." }],
  },
  {
    id: "arch-delegation",
    title: "Audit the agent diff",
    category: "architecture",
    difficulty: 5,
    summary: "The spec was refunds with an idempotency key and no card numbers. The agent did something else.",
    showInGraph: true,
    prereqs: ["arch-spec"],
    x: 1400,
    y: 300,
    kind: "review",
    signature: "Comments on agent/refund.js",
    brief: [
      { type: "p", text: "Spec: POST /refunds requires an Idempotency-Key, writes an audit row with actor id and amount, never stores or logs the card number, returns 409 when the same key is reused with a different body, and adds no user-admin endpoints." },
      { type: "p", text: "Categories: privacy, spec-miss, scope-creep, false-success. Same matching rule as the pull-request review. Tolerance is three lines." },
    ],
    constraints: ["Comment the agent's file. Do not rewrite it here."],
    hints: [],
    debrief: [{ type: "p", text: "The diff logs and stores the card number, never reads the idempotency key, adds a delete-all-users function, and turns exceptions into { ok: true }." }],
    categories: ["privacy", "spec-miss", "scope-creep", "false-success"],
    reviewFiles: [{ name: "agent/refund.js", content: agentRefund }],
    findings: [
      { file: "agent/refund.js", anchor: "req.body.cardNumber", category: "privacy", tolerance: 3, summary: "The card number is logged and stored." },
      { file: "agent/refund.js", anchor: "const amount = req.body.amount", category: "spec-miss", tolerance: 3, summary: "The Idempotency-Key is never checked." },
      { file: "agent/refund.js", anchor: "async function deleteAllUsers", category: "scope-creep", tolerance: 2, summary: "Deleting every user is not in the spec." },
      { file: "agent/refund.js", anchor: "catch (error)", category: "false-success", tolerance: 3, summary: "The catch returns success." },
    ],
  },
  {
    id: "arch-governance",
    title: "Permissions and gates",
    category: "architecture",
    difficulty: 5,
    summary: "Set the agent's tools and the checks that block a merge.",
    showInGraph: true,
    prereqs: ["arch-delegation", "sec-llm"],
    x: 1680,
    y: 180,
    kind: "governance",
    signature: "allow, ask, or deny",
    brief: [
      { type: "p", text: "The agent may read the repo and open a draft pull request. It must not run a shell. It must not read secrets. Network and writes wait for a person. Merge is blocked unless tests and SAST passed. A gate that skips tests on Friday stays off." },
    ],
    constraints: ["Mastery is every required decision.", "Lint is not in the scored set."],
    hints: [],
    debrief: [{ type: "p", text: "Read is allow. Write, fetch, and opening the draft are ask. Shell and secrets are deny. Tests and SAST are required. The Friday skip is denied." }],
    tools: [
      { id: "repo.read", description: "Read files in the repository.", answer: "allow" },
      { id: "repo.write", description: "Write files in the working tree.", answer: "ask" },
      { id: "shell.exec", description: "Run a shell command.", answer: "deny" },
      { id: "net.fetch", description: "Send an HTTP request.", answer: "ask" },
      { id: "secrets.read", description: "Read .env and other secret files.", answer: "deny" },
      { id: "pr.create", description: "Open a draft pull request.", answer: "ask" },
    ],
    gates: [
      { id: "tests", description: "Unit and integration tests passed.", answer: true },
      { id: "sast", description: "Static analysis passed.", answer: true },
      { id: "skip-tests-on-friday", description: "Skip tests on Fridays.", answer: false },
    ],
  },
  {
    id: "ml-taxonomy",
    title: "Pick the model family",
    category: "ml",
    difficulty: 2,
    summary: "Choose the smallest family that fits the data, the latency, and the label count.",
    showInGraph: true,
    prereqs: ["perf-complexity"],
    x: 840,
    y: 260,
    kind: "choice",
    signature: "Four selection calls",
    brief: [{ type: "p", text: "The trap in each question is a larger model than the problem can feed or serve. Pick the family, not a brand." }],
    constraints: ["Mastery is all four."],
    hints: [],
    debrief: [{ type: "p", text: "Tabular fraud with a lot of rows and a need to explain the score is a boosted tree. A 50 ms on-device camera is a small CNN. Two hundred labeled macros do not justify a fine-tune. A changing contract corpus is retrieval plus a model, not a transformer trained from scratch." }],
    questions: [
      {
        id: "fraud",
        prompt: "Nightly fraud scores on 2 million rows, about 50 numeric columns, and the analyst must see which features moved the score.",
        options: [
          { id: "boosted", label: "Gradient-boosted trees" },
          { id: "cnn", label: "A convolutional network" },
          { id: "llm", label: "A fine-tuned large language model" },
          { id: "scratch", label: "A transformer trained from scratch" },
        ],
        answer: "boosted",
        explanation: "The data is tabular, the volume is large, and explanation matters. Boosted trees fit that shape.",
      },
      {
        id: "camera",
        prompt: "On-device plant-disease photos. The budget is 50 ms and the device cannot call a cloud model.",
        options: [
          { id: "cnn", label: "A small convolutional network" },
          { id: "llm", label: "A hosted large language model" },
          { id: "boosted", label: "Gradient-boosted trees on raw pixels" },
          { id: "rules", label: "A keyword list" },
        ],
        answer: "cnn",
        explanation: "The input is an image and the compute is on the device. A small CNN is the matching family.",
      },
      {
        id: "macros",
        prompt: "Route support messages into 12 known replies. You have 200 labeled examples. A keyword list already gets 70 percent.",
        options: [
          { id: "classical", label: "A linear model on the text" },
          { id: "llm", label: "Fine-tune a large language model" },
          { id: "cnn", label: "A convolutional network" },
          { id: "scratch", label: "Train a transformer from scratch" },
        ],
        answer: "classical",
        explanation: "Two hundred labels can fit a linear model. They cannot honestly fit a fine-tune, and they do not need one.",
      },
      {
        id: "contracts",
        prompt: "Answer questions over a contract folder that changes every week. Two seconds of latency is acceptable. You will not train a base model.",
        options: [
          { id: "rag", label: "Retrieval plus a language model" },
          { id: "scratch", label: "Train a transformer from scratch" },
          { id: "cnn", label: "A convolutional network" },
          { id: "boosted", label: "Gradient-boosted trees" },
        ],
        answer: "rag",
        explanation: "The corpus changes and the text is unstructured. Retrieve the current pages and answer from those.",
      },
    ],
  },
  {
    id: "ml-leakage",
    title: "Find the leakage",
    category: "ml",
    difficulty: 3,
    summary: "Two steps learn from rows that the test fold is not allowed to influence.",
    showInGraph: true,
    prereqs: ["ml-taxonomy"],
    x: 1120,
    y: 240,
    kind: "flags",
    signature: "Flag the leaking steps",
    brief: [
      { type: "p", text: "Flag every step that lets information from the future test rows affect training. Leave the safe steps alone. An exact set masters the node. A partial overlap scores the Jaccard overlap." },
    ],
    constraints: ["Dropping duplicate rows before the split is not label leakage.", "A scaler fit on the training fold only is safe."],
    hints: ["A statistic computed on every row, then used as a feature, has already seen the test labels or the test distribution.", "Oversampling the minority class before the split copies test-bound rows into training."],
    debrief: [{ type: "p", text: "The column mean is computed before the split, and SMOTE runs before the split. The scaler is fit on train only, so it stays." }],
    pipeline: [
      { id: "load", text: "Load the CSV.", leak: false },
      { id: "dupes", text: "Drop exact duplicate rows.", leak: false },
      { id: "impute", text: "Fill missing age with the mean of the entire column, before the split.", leak: true },
      { id: "smote", text: "Oversample the minority class with SMOTE on the full dataset, before the split.", leak: true },
      { id: "split", text: "Split 80/20 into train and test.", leak: false },
      { id: "scale-fit", text: "Fit a standard scaler on the training fold only.", leak: false },
      { id: "scale-apply", text: "Transform train and test with that scaler.", leak: false },
      { id: "fit", text: "Fit the model on train.", leak: false },
      { id: "eval", text: "Score the model on test.", leak: false },
    ],
  },
  {
    id: "ml-cost",
    title: "Cost, latency, and the smaller tool",
    category: "ml",
    difficulty: 4,
    summary: "One option meets the accuracy bar, the latency budget, and the monthly cap.",
    showInGraph: true,
    prereqs: ["ml-leakage"],
    x: 1400,
    y: 160,
    kind: "tradeoff",
    signature: "Intent routing, 2 million requests a day",
    brief: [
      { type: "p", text: "The job is intent routing into 20 classes. The keyword rules already measured at 95 percent. The bar is 97 percent accuracy, 400 ms p95, and $4,000 a month. Average call is 800 input tokens and 120 output tokens." },
      { type: "p", text: "API cost is requests x 30 x tokens / 1,000,000 x price. Instance cost is instances x hourly x 730. The numbers in the cards use that formula. Pick the option that meets all three bars." },
    ],
    constraints: ["The measured accuracies are given. Do not invent a higher one.", "Cheaper does not win if it misses the bar."],
    hints: [],
    debrief: [{ type: "p", text: "The frontier model is accurate and far outside both the latency and the budget. The rules miss 97 percent. The batch scorer misses 400 ms. The small model on two CPU instances is the one that fits." }],
    scenario: {
      requestsPerDay: 2_000_000,
      inputTokens: 800,
      outputTokens: 120,
      latencyBudgetMs: 400,
      monthlyBudget: 4000,
      accuracyBar: 0.97,
    },
    correctOptionId: "distilled",
    options: [
      { id: "frontier", title: "Frontier language-model API", kind: "api", inputPricePerMillion: 3, outputPricePerMillion: 15, latencyMs: 900, accuracy: 0.992, note: "Measured 99.2 percent. About 900 ms." },
      { id: "distilled", title: "Small classifier on two CPU instances", kind: "instance", instances: 2, hourly: 0.15, latencyMs: 180, accuracy: 0.985, note: "Measured 98.5 percent. About 180 ms." },
      { id: "rules", title: "The existing keyword rules", kind: "heuristic", latencyMs: 5, accuracy: 0.95, note: "Measured 95 percent. No model bill." },
      { id: "batch", title: "Batch logistic regression", kind: "instance", instances: 1, hourly: 0.1, latencyMs: 2000, accuracy: 0.97, note: "Measured 97 percent. The job waits about 2 seconds." },
    ],
  },
];
