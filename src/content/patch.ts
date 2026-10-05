import type { Challenge } from "./types";

const ref = (code: string) => `// REFERENCE_SOLUTION\n${code.trim()}\n`;

const balances = { a: 100, b: 40, c: 10 };
const oneTransfer = [{ from: "a", to: "b", amount: 10 }];

export const patchChallenges: Challenge[] = [
  {
    id: "dbg-state-basics",
    number: 1,
    title: "Alias and ledger transfers",
    category: "debugging",
    difficulty: 1,
    summary: "Stop a transfer function from mutating its caller and from swallowing bad movements.",
    showInGraph: true,
    prereqs: [],
    x: 0,
    y: 40,
    kind: "patch",
    signature: "function applyTransfers(balances, transfers)",
    brief: [
      { type: "p", text: "A wallet service applies transfers to a map of account balances. The issued function looks small and is wrong in ways that only show up when the caller keeps the original object." },
      { type: "p", text: "Return a new balances object. Apply every transfer in order. Throw, and leave the input untouched, when a transfer is illegal." },
      {
        type: "ul",
        items: [
          "amount must be a finite number greater than 0, otherwise throw an error whose message includes \"invalid amount\".",
          "from === to throws \"self transfer\".",
          "A missing account throws \"unknown account\".",
          "A balance that would go negative throws \"insufficient\".",
          "Do not mutate the object that was passed in.",
        ],
      },
    ],
    constraints: ["Plain object of number balances.", "Transfers are { from, to, amount }.", "No imports."],
    hints: [
      "Assigning next = balances does not copy. The caller and the callee then share one object.",
      "Skipping a bad transfer hides it. The contract is to throw before any write to the returned object is observable through the input.",
    ],
    debrief: [
      { type: "p", text: "The issued code aliased the input, skipped unknown accounts, ignored self-transfers, and never checked funds. A copy plus a guard on each transfer makes the failure happen before the books change." },
    ],
    files: [
      {
        name: "transfers.js",
        starter: `function applyTransfers(balances, transfers) {
  const next = balances;
  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i];
    if (next[t.from] === undefined || next[t.to] === undefined) {
      continue;
    }
    if (t.from !== t.to) {
      next[t.from] = next[t.from] - t.amount;
      next[t.to] = next[t.to] + t.amount;
    }
  }
  return next;
}
`,
        traceSource: `function applyTransfers(balances, transfers) {
  const next = balances;
  __snap(2, { aliased: next === balances, a: balances.a, b: balances.b });
  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i];
    __snap(4, { i: i, from: t.from, to: t.to, amount: t.amount, fromBalance: next[t.from], toBalance: next[t.to] });
    if (next[t.from] === undefined || next[t.to] === undefined) {
      continue;
    }
    if (t.from !== t.to) {
      next[t.from] = next[t.from] - t.amount;
      next[t.to] = next[t.to] + t.amount;
      __snap(10, { i: i, fromBalance: next[t.from], toBalance: next[t.to], inputFrom: balances[t.from], inputTo: balances[t.to] });
    }
  }
  return next;
}
`,
        solution: ref(`function applyTransfers(balances, transfers) {
  if (!balances || typeof balances !== "object" || Array.isArray(balances)) throw new Error("invalid balances");
  if (!Array.isArray(transfers)) throw new Error("invalid transfers");
  const next = { ...balances };
  for (const t of transfers) {
    if (!t || typeof t.amount !== "number" || !Number.isFinite(t.amount) || t.amount <= 0) throw new Error("invalid amount");
    if (t.from === t.to) throw new Error("self transfer");
    if (!Object.prototype.hasOwnProperty.call(next, t.from) || !Object.prototype.hasOwnProperty.call(next, t.to)) throw new Error("unknown account");
    if (next[t.from] < t.amount) throw new Error("insufficient");
    next[t.from] -= t.amount;
    next[t.to] += t.amount;
  }
  return next;
}`),
      },
    ],
    scenarios: [
      {
        id: "pay-b",
        label: "Pay 10 from a to b",
        argsPreview: "{ a: 100, b: 40 } and one transfer",
        entry: "applyTransfers",
        args: [{ a: 100, b: 40 }, [{ from: "a", to: "b", amount: 10 }]],
      },
      {
        id: "self",
        label: "Self transfer is skipped",
        argsPreview: "{ a: 100 } transferring to itself",
        entry: "applyTransfers",
        args: [{ a: 100 }, [{ from: "a", to: "a", amount: 5 }]],
      },
    ],
    steps: [
      { type: "call", name: "moves 10 from a to b without touching the input", entry: "applyTransfers", args: [{ a: 100, b: 40 }, oneTransfer], expect: { a: 90, b: 50 }, freezeIndexes: [0] },
      { type: "call", name: "applies two transfers in order", entry: "applyTransfers", args: [balances, [{ from: "a", to: "b", amount: 25 }, { from: "b", to: "c", amount: 30 }]], expect: { a: 75, b: 35, c: 40 }, freezeIndexes: [0] },
      { type: "throws", name: "rejects a self transfer", entry: "applyTransfers", args: [{ a: 100 }, [{ from: "a", to: "a", amount: 5 }]], messageIncludes: "self transfer", freezeIndexes: [0] },
      { type: "throws", name: "rejects an unknown account", entry: "applyTransfers", args: [{ a: 100 }, [{ from: "a", to: "missing", amount: 5 }]], messageIncludes: "unknown account", freezeIndexes: [0] },
      { type: "throws", name: "rejects a zero amount", entry: "applyTransfers", args: [{ a: 100, b: 1 }, [{ from: "a", to: "b", amount: 0 }]], messageIncludes: "invalid amount", freezeIndexes: [0] },
      { type: "throws", name: "rejects a negative amount", entry: "applyTransfers", args: [{ a: 100, b: 1 }, [{ from: "a", to: "b", amount: -5 }]], messageIncludes: "invalid amount", freezeIndexes: [0] },
      { type: "throws", name: "rejects insufficient funds and keeps the input", entry: "applyTransfers", args: [{ a: 3, b: 1 }, [{ from: "a", to: "b", amount: 4 }]], messageIncludes: "insufficient", freezeIndexes: [0] },
    ],
  },
  {
    id: "dbg-boundaries",
    number: 2,
    title: "Pagination boundaries",
    category: "debugging",
    difficulty: 2,
    summary: "Page indexes are 1-based, and the end of the slice is exclusive.",
    showInGraph: true,
    prereqs: [],
    x: 0,
    y: 220,
    kind: "patch",
    signature: "function paginate(items, page, pageSize)",
    brief: [
      { type: "p", text: "The list API documents page as 1-based. The issued helper treats it as 0-based and drops the last item of every page." },
      {
        type: "ul",
        items: [
          "page and pageSize must be integers, and both must be at least 1.",
          "Throw \"invalid items\", \"invalid page\", or \"invalid page size\" for a bad argument.",
          "A page that starts past the end returns an empty array.",
          "Do not mutate items.",
        ],
      },
    ],
    constraints: ["Use the array you were given. Do not copy it unless you need to.", "Return a new array from slice."],
    hints: [
      "The first page is page 1, so the start index is (page - 1) * pageSize.",
      "Array.slice end is exclusive. The window length is pageSize, not pageSize - 1.",
    ],
    debrief: [
      { type: "p", text: "Off-by-one here is a contract bug, not a loop-style bug. The tests pin the first page, the last partial page, and the empty page past the end." },
    ],
    files: [
      {
        name: "page.js",
        starter: `function paginate(items, page, pageSize) {
  if (!Array.isArray(items)) return [];
  const start = page * pageSize;
  const end = start + pageSize - 1;
  return items.slice(start, end);
}
`,
        solution: ref(`function paginate(items, page, pageSize) {
  if (!Array.isArray(items)) throw new Error("invalid items");
  if (!Number.isInteger(page) || page < 1) throw new Error("invalid page");
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("invalid page size");
  const start = (page - 1) * pageSize;
  if (start >= items.length) return [];
  return items.slice(start, start + pageSize);
}`),
      },
    ],
    steps: [
      { type: "call", name: "page 1 returns the first three items", entry: "paginate", args: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 1, 3], expect: [0, 1, 2], freezeIndexes: [0] },
      { type: "call", name: "page 2 returns the next window", entry: "paginate", args: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 2, 3], expect: [3, 4, 5], freezeIndexes: [0] },
      { type: "call", name: "the last partial page keeps the tail", entry: "paginate", args: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4, 3], expect: [9] },
      { type: "call", name: "a page past the end is empty", entry: "paginate", args: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5, 3], expect: [] },
      { type: "throws", name: "page 0 is rejected", entry: "paginate", args: [[1], 0, 3], messageIncludes: "invalid page" },
      { type: "throws", name: "page size 0 is rejected", entry: "paginate", args: [[1], 1, 0], messageIncludes: "invalid page size" },
      { type: "throws", name: "a fractional page size is rejected", entry: "paginate", args: [[1], 1, 1.5], messageIncludes: "invalid page size" },
      { type: "throws", name: "a non-array throws", entry: "paginate", args: [null, 1, 3], messageIncludes: "invalid items" },
    ],
  },
  {
    id: "dbg-async-races",
    number: 4,
    title: "Lost-update reserves",
    category: "debugging",
    difficulty: 3,
    summary: "Two reserves read the same stock and both write it back.",
    showInGraph: true,
    prereqs: ["dbg-state-basics"],
    x: 560,
    y: -180,
    kind: "patch",
    signature: "async function reserve(store, sku, qty)",
    brief: [
      { type: "p", text: "Inventory reservation does read, check, write. The store yields on every call, so two reserves overlap. Both see the same stock and both succeed." },
      { type: "p", text: "The store gives you read(sku), write(sku, value), and cas(sku, expected, next). cas returns true only if the stock is still expected. Retry when it returns false." },
      {
        type: "ul",
        items: [
          "qty must be an integer greater than 0, otherwise throw \"invalid qty\".",
          "Return false when the stock cannot cover qty. Leave the stock unchanged in that case.",
          "Under overlap, the number of successes must be floor(stock / qty), and the final stock must match.",
        ],
      },
    ],
    constraints: ["Do not keep a private copy of the stock outside the store.", "The sku string is \"sku\" in the harness."],
    hints: [
      "write is not conditional. A second caller can write a stale value over the first.",
      "The loop is: read, give up if the stock is short, cas the decreased value, and read again when cas loses.",
    ],
    debrief: [
      { type: "p", text: "The harness interleaves at every await. Compare-and-swap makes the update conditional on the value you just read, so the loser retries against the new stock instead of overwriting it." },
    ],
    files: [
      {
        name: "reserve.js",
        starter: `async function reserve(store, sku, qty) {
  const current = await store.read(sku);
  if (current < qty) return false;
  await store.write(sku, current - qty);
  return true;
}
`,
        solution: ref(`async function reserve(store, sku, qty) {
  if (!Number.isInteger(qty) || qty <= 0) throw new Error("invalid qty");
  while (true) {
    const current = await store.read(sku);
    if (current < qty) return false;
    const ok = await store.cas(sku, current, current - qty);
    if (ok) return true;
  }
}`),
      },
    ],
    steps: [
      { type: "race", name: "two overlapping reserves of 3 from 5", entry: "reserve", stock: 5, qty: 3, parallel: 2, expectSuccess: 1, expectStock: 2 },
      { type: "race", name: "three overlapping reserves of 2 from 4", entry: "reserve", stock: 4, qty: 2, parallel: 3, expectSuccess: 2, expectStock: 0 },
      { type: "sequence", name: "sequential reserves stop when stock runs out", entry: "reserve", stock: 10, qtys: [4, 4, 4], expectResults: [true, true, false], expectStock: 2 },
      { type: "sequence", name: "qty 0 throws and does not change stock", entry: "reserve", stock: 5, qtys: [0], expectThrow: "invalid qty", expectStock: 5 },
    ],
  },
  {
    id: "dbg-multifile",
    number: 8,
    title: "Discount and tax checkout",
    category: "debugging",
    difficulty: 4,
    summary: "Discount mutates the order, then tax prices the already-changed lines.",
    showInGraph: true,
    prereqs: ["dbg-async-races"],
    x: 840,
    y: -240,
    kind: "patch",
    signature: "function checkout(order, discountPercent, taxRate)",
    brief: [
      { type: "p", text: "Checkout is split across three functions that share one scope in this harness. Discount rewrites unit prices in place. Tax then treats those rewritten prices as the base. The caller sees their catalog prices change." },
      {
        type: "ul",
        items: [
          "Never mutate the input order or its line objects.",
          "Returned lines keep the original unit price, sku, and qty.",
          "total = roundCents(sum(price * qty) * (1 - discountPercent / 100) * (1 + taxRate)).",
          "Round half up to cents once, at the end. Use Math.round(n * 100) / 100.",
          "discountPercent outside 0..100 throws \"bad discount\". taxRate outside 0..1 throws \"bad tax\". A missing lines array throws \"bad order\".",
        ],
      },
    ],
    constraints: ["The three files share one strict-mode scope. Use function declarations.", "Do not import."],
    hints: [
      "Copy the lines before you compute money. The return value's prices are the catalog prices, not the net prices.",
      "Apply percent and tax to the sum, then round once. Rounding each line and also mutating it will miss the cent tests.",
    ],
    debrief: [
      { type: "p", text: "The bug is the interaction. Discount's in-place write is invisible if you only look at tax, and tax looks correct if you only look at the total of whatever prices it received. The contract keeps catalog prices stable and rounds the charge once." },
    ],
    files: [
      {
        name: "discount.js",
        starter: `function applyDiscount(order, percent) {
  if (percent <= 0) return order;
  for (const line of order.lines) {
    line.price = line.price - (line.price * percent) / 100;
  }
  return order;
}
`,
        solution: ref(`function applyDiscount(order, percent) {
  if (!order || !Array.isArray(order.lines)) throw new Error("bad order");
  if (typeof percent !== "number" || percent < 0 || percent > 100) throw new Error("bad discount");
  return { lines: order.lines.map((line) => ({ sku: line.sku, price: line.price, qty: line.qty })) };
}`),
      },
      {
        name: "tax.js",
        starter: `function applyTax(order, rate) {
  const base = order.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  order.total = base + base * rate;
  return order;
}
`,
        solution: ref(`function applyTax(order, rate) {
  if (typeof rate !== "number" || rate < 0 || rate > 1) throw new Error("bad tax");
  return { lines: order.lines.map((line) => ({ sku: line.sku, price: line.price, qty: line.qty })) };
}`),
      },
      {
        name: "checkout.js",
        starter: `function checkout(order, discountPercent, taxRate) {
  const discounted = applyDiscount(order, discountPercent);
  return applyTax(discounted, taxRate);
}
`,
        solution: ref(`function checkout(order, discountPercent, taxRate) {
  const discounted = applyDiscount(order, discountPercent);
  const taxed = applyTax(discounted, taxRate);
  const net = taxed.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const discountedNet = net * (1 - discountPercent / 100);
  const total = Math.round(discountedNet * (1 + taxRate) * 100) / 100;
  return { lines: taxed.lines.map((line) => ({ sku: line.sku, price: line.price, qty: line.qty })), total };
}`),
      },
    ],
    steps: [
      {
        type: "call",
        name: "charges 24.79 and keeps catalog prices",
        entry: "checkout",
        args: [{ lines: [{ sku: "a", price: 10, qty: 2 }, { sku: "b", price: 5.5, qty: 1 }] }, 10, 0.08],
        expect: { lines: [{ sku: "a", price: 10, qty: 2 }, { sku: "b", price: 5.5, qty: 1 }], total: 24.79 },
        freezeIndexes: [0],
      },
      {
        type: "call",
        name: "rounds 19.99 times 3 with 15 percent off and 7 percent tax to 54.54",
        entry: "checkout",
        args: [{ lines: [{ sku: "a", price: 19.99, qty: 3 }] }, 15, 0.07],
        expect: { lines: [{ sku: "a", price: 19.99, qty: 3 }], total: 54.54 },
        freezeIndexes: [0],
      },
      {
        type: "call",
        name: "an empty cart totals 0",
        entry: "checkout",
        args: [{ lines: [] }, 0, 0],
        expect: { lines: [], total: 0 },
        freezeIndexes: [0],
      },
      { type: "throws", name: "discount above 100 throws", entry: "checkout", args: [{ lines: [] }, 101, 0], messageIncludes: "bad discount" },
      { type: "throws", name: "tax above 1 throws", entry: "checkout", args: [{ lines: [] }, 0, 1.2], messageIncludes: "bad tax" },
    ],
  },
  {
    id: "sec-injection",
    number: 5,
    title: "Parameterize the search",
    category: "security",
    difficulty: 2,
    summary: "A LIKE clause is built by concatenating the term.",
    showInGraph: true,
    prereqs: [],
    x: 560,
    y: 0,
    kind: "patch",
    signature: "function buildSearchQuery(term)",
    brief: [
      { type: "p", text: "Search currently interpolates the term into SQL. A quote changes the statement. The fix is a bound parameter, plus LIKE escaping so % and _ in the term stay literal." },
      {
        type: "ul",
        items: [
          "Return { text, values }.",
          "text must be exactly: SELECT id, name FROM products WHERE name LIKE $1 ESCAPE '\\'",
          "values has one element: % + escaped term + %.",
          "Escape \\, %, and _ in the term by prefixing a backslash. Do not put the raw term in text.",
          "A non-string term throws \"invalid term\".",
        ],
      },
    ],
    constraints: ["This does not open a database. The grader checks the statement shape.", "ESCAPE declares backslash as the LIKE escape character."],
    hints: [
      "If the term appears inside text, the driver will not treat it as data.",
      "Wrap the escaped term in wildcards in the bound value, not by concatenating it into the SQL.",
    ],
    debrief: [
      { type: "p", text: "Parameterization keeps the statement stable. The ESCAPE clause is what makes a search for a literal percent sign possible. Neither one replaces the other." },
    ],
    files: [
      {
        name: "search.js",
        starter: `function buildSearchQuery(term) {
  return "SELECT id, name FROM products WHERE name LIKE '%" + term + "%'";
}
`,
        solution: ref(`function buildSearchQuery(term) {
  if (typeof term !== "string") throw new Error("invalid term");
  const escaped = term.replace(/[\\\\%_]/g, (ch) => "\\\\" + ch);
  return {
    text: "SELECT id, name FROM products WHERE name LIKE $1 ESCAPE '\\\\'",
    values: ["%" + escaped + "%"],
  };
}`),
      },
    ],
    steps: [
      {
        type: "call",
        name: "a plain term is bound and wrapped",
        entry: "buildSearchQuery",
        args: ["mug"],
        expect: { text: "SELECT id, name FROM products WHERE name LIKE $1 ESCAPE '\\'", values: ["%mug%"] },
      },
      {
        type: "call",
        name: "percent and underscore stay literal",
        entry: "buildSearchQuery",
        args: ["100%_"],
        expect: { text: "SELECT id, name FROM products WHERE name LIKE $1 ESCAPE '\\'", values: ["%100\\%\\_%"] },
      },
      {
        type: "call",
        name: "a quote cannot change the statement",
        entry: "buildSearchQuery",
        args: ["a' OR '1'='1"],
        expect: { text: "SELECT id, name FROM products WHERE name LIKE $1 ESCAPE '\\'", values: ["%a' OR '1'='1%"] },
      },
      { type: "throws", name: "a non-string term throws", entry: "buildSearchQuery", args: [1], messageIncludes: "invalid term" },
    ],
  },
];
