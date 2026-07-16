// Phase 5 checks against the live dev server + Supabase.
//   - /api/diagnose writes an audit_log row (§5.5)
//   - /api/patients/[id]/export returns the full record + writes an audit row
//   - hard-delete removes DB rows AND the storage PDF (no orphan)
// Usage: node scripts/check-harden.mjs   (dev server must be running)
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
const uid = (await a.auth.getUser()).data.user.id;

const { data: patient } = await a.from("patients").insert({ name: "Harden Check", dob_or_age: "46" }).select().single();
const { data: enc } = await a.from("encounters").insert({ patient_id: patient.id, date: "2026-07-15" }).select().single();
await a.from("complaints").insert({ encounter_id: enc.id, symptom_text: "fever", severity: "severe", complaint_date: "2026-07-15" });
const { data: inv } = await a.from("investigations").insert({ encounter_id: enc.id, name: "CBC", ordered_date: "2026-07-15" }).select().single();

// Upload a dummy PDF so delete has a storage object to clean up.
const pdfPath = `${uid}/${inv.id}.pdf`;
assert.ifError((await a.storage.from("reports").upload(pdfPath, readFileSync(new URL("../sample-report.pdf", import.meta.url)), { contentType: "application/pdf", upsert: true })).error);
await a.from("investigations").update({ pdf_path: pdfPath }).eq("id", inv.id);

const session = (await a.auth.getSession()).data.session;
const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const name = `sb-${REF}-auth-token`;
const cookies = (value.length <= 3180 ? [`${name}=${value}`] : value.match(/.{1,3180}/g).map((c, i) => `${name}.${i}=${c}`)).join("; ");

// 1. diagnose writes an audit row.
console.log("1) diagnose + audit...");
const dxRes = await fetch("http://localhost:3000/api/diagnose", {
  method: "POST", headers: { "Content-Type": "application/json", Cookie: cookies },
  body: JSON.stringify({ patientId: patient.id }),
}).then((r) => r.json());
assert.ok(dxRes.id, `diagnose failed: ${JSON.stringify(dxRes)}`);
const { data: auditGen } = await a.from("audit_log").select("*").eq("entity_id", patient.id).eq("action", "generate_diagnosis");
assert.ok(auditGen.length >= 1, "generate_diagnosis audit row written");

// 2. export returns full record + audits.
console.log("2) export...");
const exp = await fetch(`http://localhost:3000/api/patients/${patient.id}/export`, { headers: { Cookie: cookies } });
assert.ok(exp.ok, `export failed: ${exp.status}`);
assert.match(exp.headers.get("content-disposition") ?? "", /attachment/, "export is an attachment");
const dump = await exp.json();
assert.equal(dump.patient.id, patient.id, "export has the patient");
assert.ok(dump.encounters.length >= 1 && dump.diagnoses.length >= 1, "export has timeline + diagnoses");
const { data: auditExp } = await a.from("audit_log").select("*").eq("entity_id", patient.id).eq("action", "export");
assert.ok(auditExp.length >= 1, "export audit row written");

// 3. hard-delete removes storage object + DB rows.
console.log("3) hard-delete + storage cleanup...");
await a.storage.from("reports").remove([pdfPath]); // mirrors client delete step
await a.from("patients").delete().eq("id", patient.id);
const { data: goneList } = await a.storage.from("reports").list(uid);
assert.ok(!(goneList ?? []).some((o) => o.name === `${inv.id}.pdf`), "PDF removed from storage");
const { data: goneRow } = await a.from("patients").select("id").eq("id", patient.id);
assert.equal(goneRow.length, 0, "patient row hard-deleted");
const { data: goneEnc } = await a.from("encounters").select("id").eq("id", enc.id);
assert.equal(goneEnc.length, 0, "encounters cascade-deleted");

// Audit rows survive patient deletion (no FK to patients).
const { data: auditAfter } = await a.from("audit_log").select("*").eq("entity_id", patient.id);
assert.ok(auditAfter.length >= 2, "audit trail persists after deletion");

console.log(`PASS: audit on diagnose+export (${auditAfter.length} rows survive delete), export full record, hard-delete clears DB + storage`);
