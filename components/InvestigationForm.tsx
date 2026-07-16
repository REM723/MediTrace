"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg, getOrCreateEncounter, today } from "@/lib/db";
import type { Investigation } from "@/lib/types";

const field = "field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2 text-sm text-[#111110] placeholder:text-neutral-300";
const lbl = "block text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400 mt-4 first:mt-0";

export default function InvestigationForm({
  patientId, initial, onDone,
}: { patientId: string; initial?: Investigation; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(initial?.ordered_date ?? today());
  const [name, setName] = useState(initial?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      const encounterId = await getOrCreateEncounter(supabase, patientId, date);
      const row = { encounter_id: encounterId, name: name.trim(), ordered_date: date };
      const { error } = initial
        ? await supabase.from("investigations").update(row).eq("id", initial.id)
        : await supabase.from("investigations").insert(row);
      if (error) throw error;
      router.refresh();
      onDone();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold text-[#111110]">{initial ? "Edit investigation" : "Add investigation"}</h3>
      <label className={lbl} htmlFor="inv-date">Date ordered</label>
      <input id="inv-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      <label className={lbl} htmlFor="inv-name">Investigation</label>
      <input id="inv-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CBC, Colonoscopy" className={field} />
      <p className="mt-2 text-[11px] text-neutral-400">Upload the report PDF from the timeline after adding.</p>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={busy} className="btn rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-40">
          {initial ? "Save" : "Add"}
        </button>
        <button type="button" onClick={onDone} className="btn rounded-lg border border-[#E4E4E3] bg-white px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
