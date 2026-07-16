// Phase 3 acceptance check against the live dev server + Supabase + Groq.
// Seeds the Appendix-A timeline plus one UNCONFIRMED finding, calls
// /api/diagnose, and asserts:
//   - ranked differential, every candidate has >=1 supporting evidence (AC #1)
//   - a disclaimer is present (FR-16)
//   - the persisted input snapshot EXCLUDES the unconfirmed finding (FR-12/13)
//   - snapshot + model_id are stored (FR-17)
// Usage: node scripts/check-diagnose-route.mjs   (dev server must be running)
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

// Seed timeline: 10 Jun fever+paracetamol, 24 Jun stool bleed + colonoscopy
// with one confirmed and one UNCONFIRMED finding, 15 Jul fever cluster.
const { data: patient } = await a.from("patients").insert({ name: "DDx Check", dob_or_age: "46", sex: "male" }).select().single();
async function enc(date) {
  return (await a.from("encounters").insert({ patient_id: patient.id, date }).select().single()).data;
}
const jun10 = await enc("2026-06-10");
await a.from("complaints").insert({ encounter_id: jun10.id, symptom_text: "fever", severity: "moderate", complaint_date: "2026-06-10" });
await a.from("prescriptions").insert({ encounter_id: jun10.id, medicine: "Paracetamol", dose: "500 mg", rx_date: "2026-06-10" });

const jun24 = await enc("2026-06-24");
await a.from("complaints").insert({ encounter_id: jun24.id, symptom_text: "red colour in stool", severity: "moderate", complaint_date: "2026-06-24" });
const { data: inv } = await a.from("investigations").insert({ encounter_id: jun24.id, name: "Colonoscopy", ordered_date: "2026-06-24" }).select().single();
await a.from("findings").insert([
  { investigation_id: inv.id, key: "Sigmoid ulcer", value: "present", abnormal_flag: true, confirmed_by_user: true },
  { investigation_id: inv.id, key: "UNCONFIRMED_SECRET", value: "must-not-leak", abnormal_flag: true, confirmed_by_user: false },
]);

const jul15 = await enc("2026-07-15");
for (const s of ["severe body pain", "fever", "headache", "constipation"]) {
  await a.from("complaints").insert({ encounter_id: jul15.id, symptom_text: s, severity: "severe", complaint_date: "2026-07-15" });
}

// Build the @supabase/ssr cookie the route reads.
const session = (await a.auth.getSession()).data.session;
const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const name = `sb-${REF}-auth-token`;
const cookies = value.length <= 3180 ? [`${name}=${value}`] : value.match(/.{1,3180}/g).map((c, i) => `${name}.${i}=${c}`);

console.log("calling /api/diagnose (Groq round-trip)...");
const res = await fetch("http://localhost:3000/api/diagnose", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookies.join("; ") },
  body: JSON.stringify({ patientId: patient.id }),
});
const body = await res.json();
assert.ok(res.ok, `route failed: ${res.status} ${JSON.stringify(body)}`);

const d = body.diagnosis;
assert.ok(d.differential.length >= 1, "ranked differential returned");
assert.ok(d.differential.every((c) => c.supporting_evidence.length >= 1), "every candidate has >=1 supporting evidence");
assert.ok(typeof d.disclaimer === "string" && d.disclaimer.length > 0, "disclaimer present");

// Persisted snapshot must exclude the unconfirmed finding.
const { data: stored } = await a.from("diagnoses").select("input_snapshot_json, model_id").eq("id", body.id).single();
const snapText = JSON.stringify(stored.input_snapshot_json);
assert.ok(!snapText.includes("UNCONFIRMED_SECRET"), "snapshot must NOT contain unconfirmed finding");
assert.ok(!snapText.includes("must-not-leak"), "snapshot must NOT contain unconfirmed value");
assert.ok(snapText.includes("Sigmoid ulcer"), "snapshot should contain confirmed finding");
assert.ok(stored.model_id && stored.model_id.length > 0, "model_id persisted");

const redFlags = d.differential.filter((c) => c.red_flag).length;
await a.from("patients").delete().eq("id", patient.id);

console.log(`PASS: ${d.differential.length} candidates (${redFlags} red-flag), evidence + disclaimer present, snapshot excludes unconfirmed finding, model ${stored.model_id}`);
