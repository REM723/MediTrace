"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

async function isAdmin() {
  const session = (await cookies()).get("admin_session")?.value;
  return !!process.env.ADMIN_PASSWORD && session === process.env.ADMIN_PASSWORD;
}

export async function adminLogin(fd: FormData) {
  const pw = fd.get("password") as string;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || pw !== expected) redirect("/admin?error=1");
  (await cookies()).set("admin_session", expected, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete("admin_session");
  redirect("/admin");
}

// Deletes all patient data (cascades to encounters, complaints, prescriptions,
// investigations, findings, diagnoses, qa_history) and the audit log.
// ponytail: leaves report PDFs in storage; add bucket wipe if needed.
export async function clearAll(fd: FormData) {
  if (!(await isAdmin())) redirect("/admin");
  if (fd.get("confirm") !== "DELETE") redirect("/admin?cleared=invalid");

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // id is never null, so this matches every row.
  await db.from("patients").delete().not("id", "is", null);
  await db.from("audit_log").delete().not("id", "is", null);
  redirect("/admin?cleared=1");
}
