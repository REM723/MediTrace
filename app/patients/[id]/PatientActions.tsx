"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg, logAudit } from "@/lib/db";
import PatientForm from "@/components/PatientForm";
import type { Patient } from "@/lib/types";

export default function PatientActions({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete ${patient.name} and their entire timeline? This cannot be undone.`)) return;
    setError(null);
    setDeleting(true);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: invs } = await supabase
        .from("investigations")
        .select("pdf_path, encounters!inner(patient_id)")
        .eq("encounters.patient_id", patient.id);
      const paths = (invs ?? []).map((i) => i.pdf_path as string | null).filter((p): p is string => !!p);
      if (paths.length > 0) await supabase.storage.from("reports").remove(paths);
      if (user) await logAudit(supabase, user.id, "delete_patient", "patient", patient.id);
      const { error } = await supabase.from("patients").delete().eq("id", patient.id);
      if (error) throw error;
      router.push("/patients");
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-3 rounded-xl border border-[#E4E4E3] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <PatientForm initial={patient} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex gap-4 text-xs">
        <button onClick={() => setEditing(true)} className="btn text-neutral-400 hover:text-neutral-700">
          Edit details
        </button>
        <a href={`/api/patients/${patient.id}/export`} className="btn text-neutral-400 hover:text-neutral-700">
          Export record
        </a>
        <button onClick={handleDelete} disabled={deleting} className="btn text-neutral-400 hover:text-red-600 disabled:opacity-40">
          {deleting ? "Deleting..." : "Delete patient"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
