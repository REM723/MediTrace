import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Timeline from "@/components/Timeline";
import PatientActions from "./PatientActions";
import type { Encounter, Patient } from "@/lib/types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: patient }, { data: allPatients }, { data: encounters }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).maybeSingle(),
    supabase.from("patients").select("id, name").order("name"),
    supabase
      .from("encounters")
      .select("*, complaints(*), prescriptions(*), investigations(*, findings(*))")
      .eq("patient_id", id)
      .order("date"),
  ]);

  if (!patient) notFound();
  const p = patient as Patient;

  const enc = (encounters ?? []) as Encounter[];
  const counts = {
    encounters: enc.length,
    complaints: enc.reduce((n, e) => n + (e.complaints?.length ?? 0), 0),
    prescriptions: enc.reduce((n, e) => n + (e.prescriptions?.length ?? 0), 0),
    investigations: enc.reduce((n, e) => n + (e.investigations?.length ?? 0), 0),
  };
  const chips = [
    { label: "Visits", value: counts.encounters, dot: "bg-neutral-400" },
    { label: "Symptoms", value: counts.complaints, dot: "bg-amber-400" },
    { label: "Prescriptions", value: counts.prescriptions, dot: "bg-sky-400" },
    { label: "Investigations", value: counts.investigations, dot: "bg-violet-400" },
  ];

  return (
    <main className="grid min-h-full grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* Left: patient list nav */}
      <nav className="border-b border-[#E4E4E3] bg-white p-4 lg:border-b-0 lg:border-r lg:overflow-y-auto">
        <Link
          href="/patients"
          className="btn flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-500 hover:bg-[#F7F7F6] hover:text-[#111110]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Dashboard
        </Link>
        <div className="my-3 h-px bg-[#F0F0EF]" />
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Patients</p>
        <ul className="mt-2 space-y-0.5">
          {((allPatients ?? []) as { id: string; name: string }[]).map((row) => (
            <li key={row.id}>
              <Link
                href={`/patients/${row.id}`}
                className={`btn flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  row.id === id
                    ? "bg-[#F0F0EF] font-medium text-[#111110]"
                    : "text-neutral-500 hover:bg-[#F7F7F6] hover:text-[#111110]"
                }`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  row.id === id ? "bg-blue-800 text-white" : "bg-neutral-200 text-neutral-600"
                }`}>
                  {initials(row.name)}
                </div>
                <span className="truncate">{row.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Center: patient header + timeline */}
      <div className="bg-[#F7F7F6] p-6">
        {/* Patient header card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#E4E4E3] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="h-1 bg-gradient-to-r from-blue-800 via-blue-600 to-blue-800" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-800 text-base font-semibold text-white shadow-[0_2px_8px_rgba(30,64,175,0.25)]">
                  {initials(p.name)}
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-tight text-[#111110]">{p.name}</h1>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {[p.dob_or_age, p.sex].filter(Boolean).join(", ") || "No details recorded"}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
              </div>
              <Link
                href={`/patients/${id}/diagnose`}
                className="btn shrink-0 flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Generate diagnosis
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {chips.map((c) => (
                <div key={c.label} className="rounded-xl border border-[#F0F0EF] bg-[#FAFAFA] px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{c.label}</span>
                  </div>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#111110]">{c.value}</p>
                </div>
              ))}
            </div>

            <PatientActions patient={p} />
          </div>
        </div>

        <div className="mt-7">
          <Timeline patientId={id} encounters={enc} />
        </div>
      </div>
    </main>
  );
}
