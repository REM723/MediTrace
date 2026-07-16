// RLS acceptance check: user B must never see user A's patients or timeline.
// Usage: node scripts/check-rls.mjs signup   (creates the two test users)
//        node scripts/check-rls.mjs check    (runs the isolation assertions)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const A = { email: "ryanelijahmathew23+rlsa@gmail.com", password: "rls-check-pass-1" };
const B = { email: "ryanelijahmathew23+rlsb@gmail.com", password: "rls-check-pass-2" };

const mode = process.argv[2];

if (mode === "signup") {
  for (const u of [A, B]) {
    const client = createClient(URL_, ANON);
    const { data, error } = await client.auth.signUp(u);
    if (error) throw error;
    console.log(u.email, data.session ? "session (no confirm needed)" : "created, needs email confirm");
  }
} else if (mode === "check") {
  const clientA = createClient(URL_, ANON);
  const clientB = createClient(URL_, ANON);
  const { error: eA } = await clientA.auth.signInWithPassword(A);
  if (eA) throw eA;
  const { error: eB } = await clientB.auth.signInWithPassword(B);
  if (eB) throw eB;

  // A creates a patient with an encounter and a complaint.
  const { data: patient, error: e1 } = await clientA
    .from("patients").insert({ name: "RLS Check A" }).select().single();
  if (e1) throw e1;
  const { data: enc, error: e2 } = await clientA
    .from("encounters").insert({ patient_id: patient.id, date: "2026-07-16" }).select().single();
  if (e2) throw e2;
  const { error: e3 } = await clientA.from("complaints").insert({
    encounter_id: enc.id, symptom_text: "rls probe", complaint_date: "2026-07-16",
  });
  if (e3) throw e3;

  // A can read its own row back.
  const { data: ownRows } = await clientA.from("patients").select("id").eq("id", patient.id);
  assert.equal(ownRows.length, 1, "A should see its own patient");

  // B sees nothing of A's.
  const { data: bPatients } = await clientB.from("patients").select("id").eq("id", patient.id);
  assert.equal(bPatients.length, 0, "B must not see A's patient");
  const { data: bComplaints } = await clientB.from("complaints").select("id").eq("encounter_id", enc.id);
  assert.equal(bComplaints.length, 0, "B must not see A's complaints");

  // B cannot modify A's patient (update matches 0 rows under RLS).
  const { data: bUpdate } = await clientB
    .from("patients").update({ name: "hacked" }).eq("id", patient.id).select();
  assert.equal(bUpdate.length, 0, "B must not update A's patient");

  // B cannot attach data to A's encounter (with check blocks the insert).
  const { error: bInsertErr } = await clientB.from("complaints").insert({
    encounter_id: enc.id, symptom_text: "intruder", complaint_date: "2026-07-16",
  });
  assert.ok(bInsertErr, "B inserting into A's encounter must fail");

  // Cleanup: cascades remove encounter and complaint.
  await clientA.from("patients").delete().eq("id", patient.id);

  console.log("PASS: RLS isolates users A and B");
} else {
  throw new Error("usage: node scripts/check-rls.mjs signup|check");
}
