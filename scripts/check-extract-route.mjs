// End-to-end Phase 2 check against the live Supabase project and a running
// dev server (npm run dev first). Verifies: storage RLS isolation, the
// /api/extract-pdf route, and that extracted findings land unconfirmed.
// Usage: node scripts/check-extract-route.mjs
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
const REF = new URL(URL_).hostname.split(".")[0];

const A = { email: "ryanelijahmathew23+rlsa@gmail.com", password: "rls-check-pass-1" };
const B = { email: "ryanelijahmathew23+rlsb@gmail.com", password: "rls-check-pass-2" };

const a = createClient(URL_, ANON);
const b = createClient(URL_, ANON);
assert.ifError((await a.auth.signInWithPassword(A)).error);
assert.ifError((await b.auth.signInWithPassword(B)).error);
const userA = (await a.auth.getUser()).data.user;

const pdf = readFileSync(new URL("../sample-report.pdf", import.meta.url));

// A's investigation with an uploaded report.
const { data: patient } = await a
  .from("patients").insert({ name: "E2E Extract Check" }).select().single();
const { data: enc } = await a
  .from("encounters").insert({ patient_id: patient.id, date: "2026-06-24" }).select().single();
const { data: inv } = await a
  .from("investigations")
  .insert({ encounter_id: enc.id, name: "Colonoscopy", ordered_date: "2026-06-24" })
  .select().single();

const path = `${userA.id}/${inv.id}.pdf`;
assert.ifError(
  (await a.storage.from("reports").upload(path, pdf, { contentType: "application/pdf", upsert: true })).error
);

// Storage RLS: B can neither read A's file nor write into A's folder.
assert.ok((await b.storage.from("reports").download(path)).error, "B must not download A's PDF");
assert.ok(
  (await b.storage.from("reports").upload(`${userA.id}/intruder.pdf`, pdf)).error,
  "B must not upload into A's folder"
);
assert.ifError((await a.storage.from("reports").download(path)).error);

await a.from("investigations").update({ pdf_path: path, extraction_status: "pending" }).eq("id", inv.id);

// Call the route the way the browser would: session in the @supabase/ssr cookie.
const session = (await a.auth.getSession()).data.session;
const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const name = `sb-${REF}-auth-token`;
const cookies =
  value.length <= 3180
    ? [`${name}=${value}`]
    : value.match(/.{1,3180}/g).map((c, i) => `${name}.${i}=${c}`);

const res = await fetch("http://localhost:3000/api/extract-pdf", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookies.join("; ") },
  body: JSON.stringify({ investigationId: inv.id }),
});
const body = await res.json();
assert.ok(res.ok, `route failed: ${res.status} ${JSON.stringify(body)}`);
assert.ok(body.count >= 3, `expected >=3 findings, got ${body.count}`);

const { data: rows } = await a.from("findings").select("*").eq("investigation_id", inv.id);
assert.ok(rows.length >= 3, "findings persisted");
assert.ok(rows.every((r) => r.confirmed_by_user === false), "all findings start unconfirmed");
const { data: invAfter } = await a
  .from("investigations").select("extraction_status").eq("id", inv.id).single();
assert.equal(invAfter.extraction_status, "extracted");

// Cleanup.
await a.from("patients").delete().eq("id", patient.id);
await a.storage.from("reports").remove([path]);

console.log(`PASS: storage RLS + extract route (${rows.length} unconfirmed findings)`);
