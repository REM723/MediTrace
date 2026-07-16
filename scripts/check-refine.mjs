// Phase 4 acceptance check against the live dev server + Supabase + Groq.
// Verifies FR-19/FR-21 (answers re-enter context) and FR-22 (freeze).
// Usage: node scripts/check-refine.mjs   (dev server must be running)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REF = new URL(URL_).hostname.split(".")[0];
const A = { email: "ryanelijahmathew23+rlsa@gmail.com", password: "rls-check-pass-1" };

const a = createClient(URL_, ANON);
assert.ifError((await a.auth.signInWithPassword(A)).error);

const { data: patient } = await a.from("patients").insert({ name: "Refine Check", dob_or_age: "46", sex: "male" }).select().single();
const { data: enc } = await a.from("encounters").insert({ patient_id: patient.id, date: "2026-07-15" }).select().single();
for (const s of ["severe body pain", "fever", "headache", "constipation"]) {
  await a.from("complaints").insert({ encounter_id: enc.id, symptom_text: s, severity: "severe", complaint_date: "2026-07-15" });
}

const session = (await a.auth.getSession()).data.session;
const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const name = `sb-${REF}-auth-token`;
const cookies = value.length <= 3180 ? [`${name}=${value}`] : value.match(/.{1,3180}/g).map((c, i) => `${name}.${i}=${c}`);
const call = () =>
  fetch("http://localhost:3000/api/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies.join("; ") },
    body: JSON.stringify({ patientId: patient.id }),
  }).then((r) => r.json());

console.log("1) first diagnosis...");
const first = await call();
assert.ok(first.id, `first call failed: ${JSON.stringify(first)}`);
assert.equal(first.status, "draft", "new report starts as draft");

// Answer a distinctive fact the doctor supplies, tied to the report that asked.
const MARKER = "recent travel to a malaria-endemic region last week";
const q = first.diagnosis.follow_up_questions[0] ?? "Any relevant exposures?";
assert.ifError((await a.from("qa_history").insert({ diagnosis_id: first.id, question: q, answer: MARKER })).error);

console.log("2) re-run with the answer in context...");
const second = await call();
assert.ok(second.id && second.id !== first.id, "regenerate creates a new report");

// FR-21: the answer must be captured in the new report's persisted snapshot.
const { data: stored } = await a.from("diagnoses").select("input_snapshot_json").eq("id", second.id).single();
assert.ok(JSON.stringify(stored.input_snapshot_json).includes(MARKER), "answer must be in the new report's context snapshot");

// FR-22: freeze persists.
console.log("3) freeze...");
assert.ifError((await a.from("diagnoses").update({ status: "frozen" }).eq("id", second.id)).error);
const { data: frozen } = await a.from("diagnoses").select("status").eq("id", second.id).single();
assert.equal(frozen.status, "frozen", "status persists as frozen");

await a.from("patients").delete().eq("id", patient.id);
console.log("PASS: answers re-enter context (FR-19/21), report freezes (FR-22)");
