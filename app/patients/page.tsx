import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PatientForm from "@/components/PatientForm";
import type { Patient } from "@/lib/types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

const AVATAR_COLORS = ["bg-blue-800", "bg-emerald-700", "bg-violet-700", "bg-amber-600", "bg-rose-600", "bg-cyan-700"];
function avatar(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default async function PatientsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });
  const patients = (data ?? []) as Patient[];

  return (
    <>
      {/* Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-blue-900">
        <svg className="absolute inset-0 h-full w-full text-white/10" preserveAspectRatio="none" viewBox="0 0 800 160" fill="none" aria-hidden>
          <path d="M0 100 H180 L200 60 L224 132 L248 40 L272 110 L300 100 H520 L540 60 L564 132 L588 40 L612 110 L640 100 H800" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="relative mx-auto flex max-w-4xl items-center justify-between px-6 py-10">
          <div>
            <h1 className="text-2xl font-semibold text-white">Your patients</h1>
            <p className="mt-1 text-sm text-blue-100">Longitudinal records and diagnostic support in one place.</p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-3xl font-semibold tabular-nums text-white">{patients.length}</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-blue-200">under care</p>
          </div>
        </div>
      </div>

    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="grid gap-8 sm:grid-cols-[1fr_300px]">
        {/* Patient list */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight text-[#111110]">Patients</h2>
            <span className="text-xs text-neutral-400">{patients.length > 0 ? `${patients.length} total` : ""}</span>
          </div>

          {patients.length === 0 ? (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-[#E4E4E3] bg-white py-14 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              {/* Person + add SVG illustration */}
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
                <circle cx="24" cy="18" r="10" stroke="#D4D4D3" strokeWidth="1.5"/>
                <path d="M6 50c0-9.941 8.059-18 18-18" stroke="#D4D4D3" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="42" cy="38" r="8" fill="white" stroke="#D4D4D3" strokeWidth="1.5"/>
                <path d="M42 34.5v7M38.5 38h7" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p className="mt-4 text-sm font-medium text-neutral-600">No patients yet</p>
              <p className="mt-1 text-xs text-neutral-400">Add your first patient using the form</p>
            </div>
          ) : (
            <ul className="mt-4 overflow-hidden rounded-2xl border border-[#E4E4E3] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              {patients.map((p, i) => (
                <li key={p.id} className={i > 0 ? "border-t border-[#F0F0EF]" : ""}>
                  <Link
                    href={`/patients/${p.id}`}
                    className="btn group flex items-center gap-3 px-4 py-3.5 hover:bg-[#F9F9F8]"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${avatar(p.name)}`}>
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#111110]">{p.name}</div>
                      <div className="mt-0.5 text-xs text-neutral-400">
                        {[p.dob_or_age, p.sex].filter(Boolean).join(", ") || "No details"}
                        {" · added " + new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" aria-hidden>
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* New patient form */}
        <aside>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-400">New patient</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#E4E4E3] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-1 bg-gradient-to-r from-blue-800 via-blue-600 to-blue-800" />
            <div className="p-5">
              <PatientForm />
            </div>
          </div>

          <p className="mt-4 rounded-xl border border-[#E4E4E3] bg-white px-4 py-3 text-xs text-neutral-500">
            New here? Add a patient, then open their record to log symptoms, prescriptions, and
            investigations before generating a diagnosis.{" "}
            <Link href="/patients/guide" className="btn font-medium text-blue-700 hover:text-blue-900">
              Read the guide
            </Link>
          </p>
        </aside>
      </div>
    </main>
    </>
  );
}
