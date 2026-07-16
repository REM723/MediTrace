// Offline check of the Groq backoff logic (NFR-3): stub fetch to fail with
// retryable/non-retryable statuses and assert the retry behaviour.
// groq.ts imports nothing aliased, so it loads in bare node.
import assert from "node:assert";

process.env.GROQ_API_KEY = "test-key";
process.env.GROQ_MODEL_ID = "test-model";
const { chatJson } = await import("../lib/groq.ts");

function stub(sequence) {
  let i = 0;
  const calls = [];
  global.fetch = async () => {
    const step = sequence[Math.min(i, sequence.length - 1)];
    calls.push(step.status);
    i++;
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      headers: new Map(),
      async json() { return { choices: [{ message: { content: step.body ?? "{}" } }] }; },
      async text() { return step.body ?? ""; },
    };
  };
  return calls;
}

// 503 twice then 200: should retry and succeed after 3 calls.
let calls = stub([{ status: 503 }, { status: 503 }, { status: 200, body: '{"ok":true}' }]);
const out = await chatJson([{ role: "user", content: "hi" }]);
assert.equal(out, '{"ok":true}', "returns content after transient failures");
assert.equal(calls.length, 3, `expected 3 attempts, got ${calls.length}`);

// 400 bad request: not retryable, must fail fast on the first call.
calls = stub([{ status: 400, body: "bad" }]);
await assert.rejects(() => chatJson([{ role: "user", content: "hi" }]), /400/);
assert.equal(calls.length, 1, "4xx must not retry");

// 500 every time: exhausts attempts (3) then throws.
calls = stub([{ status: 500 }]);
await assert.rejects(() => chatJson([{ role: "user", content: "hi" }]), /500/);
assert.equal(calls.length, 3, "persistent 5xx exhausts 3 attempts");

console.log("PASS: retries transient 5xx, fails fast on 4xx, caps at 3 attempts");
