import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DdxPanel from "@/components/DdxPanel";
import type { Patient } from "@/lib/types";
import type { Diagnosis } from "@/lib/schema";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

export default async function DiagnosePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: patient }, { data: lastDx }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("diagnoses")
      .select("id, ddx_json, created_at, model_id, status, qa_history(question, answer)")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!patient) notFound();
  const p = patient as Patient;

  const initialDx = lastDx
    ? {
        id: lastDx.id as string,
        diagnosis: lastDx.ddx_json as Diagnosis,
        created_at: lastDx.created_at as string,
        model: lastDx.model_id as string,
        status: lastDx.status as string,
      }
    : null;
  const initialQa = (lastDx?.qa_history ?? []) as { question: string; answer: string }[];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="flex items-center gap-4">
        <Link
          href="/patients"
          className="btn inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Dashboard
        </Link>
        <Link
          href={`/patients/${id}`}
          className="btn inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to timeline
        </Link>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-800 text-sm font-semibold text-white">
          {initials(p.name)}
        </div>
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-[#111110]">{p.name}</h1>
          <p className="text-xs text-neutral-500">
            {[p.dob_or_age, p.sex].filter(Boolean).join(", ") || "No details recorded"}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#E4E4E3] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <DdxPanel patientId={id} patientName={p.name} initial={initialDx} initialQa={initialQa} />
      </div>
    </main>
  );
}
