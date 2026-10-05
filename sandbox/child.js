"use strict";

const vm = require("node:vm");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const dns = require("node:dns");

const BLOCKED = "network disabled in the sandbox";

function blockNetwork() {
  const fail = () => {
    throw new Error(BLOCKED);
  };
  http.request = fail;
  http.get = fail;
  https.request = fail;
  https.get = fail;
  net.Socket.prototype.connect = fail;
  net.connect = fail;
  net.createConnection = fail;
  dns.lookup = fail;
  dns.lookupService = fail;
  dns.resolve = fail;
  dns.resolve4 = fail;
  dns.resolve6 = fail;
  if (typeof globalThis.fetch === "function") {
    globalThis.fetch = async () => {
      throw new Error(BLOCKED);
    };
  }
}

blockNetwork();

const SECRET_ENV = Object.keys(process.env).filter((key) =>
  /DATABASE|PASS|SECRET|KEY|TOKEN/i.test(key),
);

function meta() {
  return { secretEnv: SECRET_ENV };
}

function deepEqual(left, right) {
  if (left === right) return true;
  if (typeof left === "number" && typeof right === "number") {
    return Object.is(left, right) || Math.abs(left - right) < 1e-9;
  }
  if (left === null || right === null) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (!deepEqual(left[i], right[i])) return false;
    }
    return true;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!deepEqual(left[key], right[key])) return false;
  }
  return true;
}

function clone(value) {
  return structuredClone(value);
}

function errorMessage(error) {
  if (error && typeof error.message === "string") return error.message;
  return String(error);
}

function createRealm(extras) {
  const realm = Object.create(null);
  const names = [
    "Object",
    "Array",
    "String",
    "Number",
    "Boolean",
    "Math",
    "JSON",
    "Date",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "Promise",
    "Error",
    "TypeError",
    "RangeError",
    "RegExp",
    "Symbol",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "Infinity",
    "NaN",
    "BigInt",
    "ArrayBuffer",
    "Uint8Array",
    "Int32Array",
    "Float64Array",
    "TextEncoder",
    "TextDecoder",
    "structuredClone",
    "Proxy",
    "Reflect",
  ];
  for (const name of names) realm[name] = globalThis[name];
  realm.console = {
    log() {},
  };
  realm.globalThis = realm;
  if (extras) Object.assign(realm, extras);
  return realm;
}

function loadSource(source, extras, timeoutMs) {
  const realm = createRealm(extras);
  const context = vm.createContext(realm);
  const script = new vm.Script(`'use strict';\n${source}\n`, {
    filename: "submission.js",
  });
  script.runInContext(context, { timeout: timeoutMs });
  return realm;
}

function loadFiles(files, order, extras, timeoutMs) {
  const missing = order.filter((name) => typeof files[name] !== "string");
  if (missing.length) {
    throw new Error(`Missing file ${missing[0]}`);
  }
  const source = order.map((name) => files[name]).join("\n");
  return loadSource(source, extras, timeoutMs);
}

async function callFn(realm, entry, args, timeoutMs) {
  const fn = realm[entry];
  if (typeof fn !== "function") {
    throw new Error(`Expected a function named ${entry}.`);
  }
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(fn(...args)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("step timed out")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function makeImmediateStore(box) {
  return {
    async read() {
      return box.stock;
    },
    async write(_sku, value) {
      box.stock = value;
      return true;
    },
    async cas(_sku, expected, next) {
      if (box.stock === expected) {
        box.stock = next;
        return true;
      }
      return false;
    },
  };
}

async function runRace(reserve, step) {
  let stock = step.stock;
  const pending = [];
  let pumping = false;
  let steps = 0;

  function pump() {
    if (pumping) return;
    pumping = true;
    queueMicrotask(() => {
      pumping = false;
      if (pending.length === 0) return;
      if (steps >= 500) {
        const rest = pending.splice(0);
        for (const job of rest) job.reject(new Error("too many yields"));
        return;
      }
      steps += 1;
      const job = pending.shift();
      try {
        job.resolve(job.apply());
      } catch (error) {
        job.reject(error);
      }
      if (pending.length) pump();
    });
  }

  function checkpoint(apply) {
    return new Promise((resolve, reject) => {
      pending.push({ apply, resolve, reject });
      pump();
    });
  }

  const store = {
    read() {
      return checkpoint(() => stock);
    },
    write(_sku, value) {
      return checkpoint(() => {
        stock = value;
        return true;
      });
    },
    cas(_sku, expected, next) {
      return checkpoint(() => {
        if (stock === expected) {
          stock = next;
          return true;
        }
        return false;
      });
    },
  };

  const runs = [];
  for (let i = 0; i < step.parallel; i += 1) {
    runs.push(Promise.resolve().then(() => reserve(store, "sku", step.qty)));
  }
  const results = await Promise.all(runs);
  const success = results.filter((value) => value === true).length;
  return { success, stock, results };
}

function makeLedger(state) {
  return {
    async read() {
      return state.balance;
    },
    async write(value) {
      state.balance = value;
      return true;
    },
    async cas(expected, next) {
      if (state.balance === expected) {
        state.balance = next;
        return true;
      }
      return false;
    },
    async getRefund(key) {
      return state.keys.get(key) ?? null;
    },
    async putRefund(key, record) {
      if (state.keys.has(key)) return false;
      state.keys.set(key, record);
      return true;
    },
  };
}

function createQueryDb(users, orders) {
  let queries = 0;
  const byId = new Map(users.map((user) => [user.id, user]));
  return {
    async user(id) {
      queries += 1;
      const found = byId.get(id);
      return found ? { ...found } : null;
    },
    async users(ids) {
      queries += 1;
      return ids.map((id) => ({ ...byId.get(id) }));
    },
    async ordersFor(userId) {
      queries += 1;
      return orders.filter((order) => order.userId === userId).map((order) => ({ ...order }));
    },
    async ordersForUsers(ids) {
      queries += 1;
      const wanted = new Set(ids);
      return orders.filter((order) => wanted.has(order.userId)).map((order) => ({ ...order }));
    },
    queryCount() {
      return queries;
    },
  };
}

function makeUsers(n) {
  const users = [];
  const half = n / 2;
  for (let i = 0; i < n; i += 1) {
    users.push({ email: `User${i % half}@Example.com` });
  }
  return users;
}

async function runStep(realm, step) {
  const started = process.hrtime.bigint();
  const finish = (passed, message, data) => ({
    name: step.name,
    passed,
    message,
    ms: Number(process.hrtime.bigint() - started) / 1e6,
    data: data ?? null,
  });

  try {
    if (step.type === "call" || step.type === "throws") {
      const args = clone(step.args);
      const frozen = (step.freezeIndexes ?? []).map((index) => clone(args[index]));
      if (step.type === "throws") {
        try {
          await callFn(realm, step.entry, args, step.timeoutMs ?? 1000);
          return finish(false, "Expected the function to throw.");
        } catch (error) {
          const message = errorMessage(error);
          if (message === "step timed out") return finish(false, message);
          if (!message.includes(step.messageIncludes)) {
            return finish(false, `Threw "${message}", which does not include "${step.messageIncludes}".`);
          }
        }
      } else {
        const value = await callFn(realm, step.entry, args, step.timeoutMs ?? 1000);
        if (!deepEqual(value, step.expect)) {
          return finish(false, `Returned ${JSON.stringify(value)}, expected ${JSON.stringify(step.expect)}.`);
        }
      }
      for (let i = 0; i < (step.freezeIndexes ?? []).length; i += 1) {
        const index = step.freezeIndexes[i];
        if (!deepEqual(args[index], frozen[i])) {
          return finish(false, `Argument ${index} was mutated.`);
        }
      }
      return finish(true, "Passed.");
    }

    if (step.type === "race") {
      const outcome = await runRace(realm[step.entry], step);
      if (typeof realm[step.entry] !== "function") {
        return finish(false, `Expected a function named ${step.entry}.`);
      }
      if (outcome.success !== step.expectSuccess || outcome.stock !== step.expectStock) {
        return finish(
          false,
          `Successes ${outcome.success}, stock ${outcome.stock}. Expected ${step.expectSuccess} successes and stock ${step.expectStock}.`,
        );
      }
      return finish(true, "Passed.");
    }

    if (step.type === "sequence") {
      if (typeof realm[step.entry] !== "function") {
        return finish(false, `Expected a function named ${step.entry}.`);
      }
      const box = { stock: step.stock };
      const store = makeImmediateStore(box);
      if (step.expectThrow) {
        try {
          await callFn(realm, step.entry, [store, "sku", step.qtys[0]], 1000);
          return finish(false, "Expected the function to throw.");
        } catch (error) {
          const message = errorMessage(error);
          if (!message.includes(step.expectThrow)) {
            return finish(false, `Threw "${message}", which does not include "${step.expectThrow}".`);
          }
          if (box.stock !== step.expectStock) return finish(false, "The stock changed.");
          return finish(true, "Passed.");
        }
      }
      const results = [];
      for (const qty of step.qtys) {
        results.push(await callFn(realm, step.entry, [store, "sku", qty], 1000));
      }
      if (!deepEqual(results, step.expectResults) || box.stock !== step.expectStock) {
        return finish(
          false,
          `Results ${JSON.stringify(results)}, stock ${box.stock}. Expected ${JSON.stringify(step.expectResults)} and stock ${step.expectStock}.`,
        );
      }
      return finish(true, "Passed.");
    }

    if (step.type === "queries") {
      const db = createQueryDb(step.users, step.orders);
      const value = await callFn(realm, step.entry, [db, step.ids], 1000);
      const expected = step.ids.map((id) => ({
        ...step.users.find((user) => user.id === id),
        orders: step.orders.filter((order) => order.userId === id),
      }));
      if (!deepEqual(value, expected)) {
        return finish(false, `Returned ${JSON.stringify(value)}, expected ${JSON.stringify(expected)}.`);
      }
      if (db.queryCount() > step.maxQueries) {
        return finish(false, `Used ${db.queryCount()} queries. The budget is ${step.maxQueries}.`);
      }
      return finish(true, `Passed in ${db.queryCount()} queries.`);
    }

    if (step.type === "yields") {
      let yields = 0;
      const yieldTick = async () => {
        yields += 1;
      };
      const events = step.values.map((value) => ({ value }));
      const sum = await callFn(realm, step.entry, [events, yieldTick], 1500);
      if (sum !== step.expectSum) {
        return finish(false, `Sum ${sum}, expected ${step.expectSum}.`);
      }
      if (yields < step.minYields) {
        return finish(false, `Yielded ${yields} times. Need at least ${step.minYields}.`);
      }
      return finish(true, `Passed with ${yields} yields.`);
    }

    if (step.type === "bench") {
      const users = makeUsers(step.n);
      const startedBench = process.hrtime.bigint();
      const value = await callFn(realm, step.entry, [users], step.timeoutMs ?? 2500);
      const ms = Number(process.hrtime.bigint() - startedBench) / 1e6;
      if (!Array.isArray(value) || value.length !== step.expectCount) {
        return finish(false, `Returned ${Array.isArray(value) ? value.length : typeof value} duplicates, expected ${step.expectCount}.`, { ms });
      }
      if (ms > step.maxMs) {
        return finish(false, `Took ${ms.toFixed(1)} ms. The budget is ${step.maxMs} ms.`, { ms });
      }
      return finish(true, `Passed in ${ms.toFixed(1)} ms.`, { ms });
    }

    if (step.type === "ledger") {
      const state = { balance: step.startBalance, keys: new Map() };
      const store = makeLedger(state);
      const actual = [];
      for (const item of step.steps) {
        try {
          const value = await callFn(
            realm,
            step.entry,
            [store, item.session, item.payment, item.amount, item.key],
            1000,
          );
          actual.push({ ok: true, value, balance: state.balance });
        } catch (error) {
          actual.push({ ok: false, error: errorMessage(error), balance: state.balance });
        }
      }
      if (!deepEqual(actual, step.expect)) {
        return finish(false, `Ledger script returned ${JSON.stringify(actual)}.`);
      }
      return finish(true, "Passed.");
    }

    if (step.type === "trace") {
      const frames = [];
      const traced = loadSource(
        step.source,
        {
          __snap(line, locals) {
            frames.push({ line, locals: clone(locals) });
          },
        },
        1000,
      );
      await callFn(traced, step.entry, clone(step.args), 1000);
      return finish(true, "Traced.", frames);
    }

    return finish(false, `Unknown step ${step.type}.`);
  } catch (error) {
    return finish(false, errorMessage(error));
  }
}

async function main(job) {
  const files = job.files ?? {};
  const order = job.order ?? [];
  const results = [];
  let realm = null;
  const needsRealm = (job.steps ?? []).some((step) => step.type !== "trace");
  if (needsRealm) {
    realm = loadFiles(files, order, null, job.loadTimeoutMs ?? 1000);
  }
  for (const step of job.steps ?? []) {
    results.push(await runStep(realm, step));
  }
  return { ok: true, results, meta: meta() };
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
  if (raw.length > 1_500_000) {
    process.stdout.write(JSON.stringify({ ok: false, error: "Submission is too large.", results: [], meta: meta() }));
    process.exit(0);
  }
});
process.stdin.on("end", () => {
  main(JSON.parse(raw))
    .then((output) => {
      process.stdout.write(JSON.stringify(output));
    })
    .catch((error) => {
      process.stdout.write(
        JSON.stringify({
          ok: false,
          error: errorMessage(error),
          results: [],
          meta: meta(),
        }),
      );
    });
});
