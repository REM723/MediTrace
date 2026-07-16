"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg, getOrCreateEncounter, today } from "@/lib/db";
import type { Complaint } from "@/lib/types";

const field = "field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2 text-sm text-[#111110] placeholder:text-neutral-300";
const lbl = "block text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400 mt-4 first:mt-0";

export default function ComplaintForm({
  patientId, initial, onDone,
}: { patientId: string; initial?: Complaint; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(initial?.complaint_date ?? today());
  const [text, setText] = useState(initial?.symptom_text ?? "");
  const [tag, setTag] = useState(initial?.symptom_tag ?? "");
  const [severity, setSeverity] = useState(initial?.severity ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      const encounterId = await getOrCreateEncounter(supabase, patientId, date);
      const row = { encounter_id: encounterId, symptom_text: text.trim(), symptom_tag: tag.trim() || null, severity: severity || null, complaint_date: date };
      const { error } = initial
        ? await supabase.from("complaints").update(row).eq("id", initial.id)
        : await supabase.from("complaints").insert(row);
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
      <h3 className="text-sm font-semibold text-[#111110]">{initial ? "Edit symptom" : "Add symptom"}</h3>
      <label className={lbl} htmlFor="c-date">Date</label>
      <input id="c-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      <label className={lbl} htmlFor="c-text">Symptom</label>
      <input id="c-text" required value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. fever since 3 days" className={field} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl} htmlFor="c-severity">Severity</label>
          <select id="c-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={field}>
            <option value="">Not graded</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="c-tag">Tag (optional)</label>
          <input id="c-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. GI" className={field} />
        </div>
      </div>
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
