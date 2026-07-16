"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/db";
import type { Patient } from "@/lib/types";

const field = "field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2 text-sm text-[#111110] placeholder:text-neutral-300";
const lbl = "block text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400 mt-4 first:mt-0";

export default function PatientForm({ initial, onDone }: { initial?: Patient; onDone?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [dobOrAge, setDobOrAge] = useState(initial?.dob_or_age ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const row = {
      name: name.trim(),
      dob_or_age: dobOrAge.trim() || null,
      sex: sex || null,
      notes: notes.trim() || null,
    };
    const { error } = initial
      ? await supabase.from("patients").update(row).eq("id", initial.id)
      : await supabase.from("patients").insert(row);
    setBusy(false);
    if (error) { setError(errMsg(error)); return; }
    if (!initial) { setName(""); setDobOrAge(""); setSex(""); setNotes(""); }
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className={lbl} htmlFor="pt-name">Name</label>
      <input id="pt-name" required value={name} onChange={(e) => setName(e.target.value)} className={field} />

      <label className={lbl} htmlFor="pt-age">Age or date of birth</label>
      <input id="pt-age" value={dobOrAge} onChange={(e) => setDobOrAge(e.target.value)} placeholder="e.g. 46 or 1979-03-12" className={field} />

      <label className={lbl} htmlFor="pt-sex">Sex</label>
      <select id="pt-sex" value={sex} onChange={(e) => setSex(e.target.value)} className={field}>
        <option value="">Not recorded</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="other">Other</option>
      </select>

      <label className={lbl} htmlFor="pt-notes">Notes</label>
      <textarea id="pt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={field} />

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={busy} className="btn rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-40">
          {initial ? "Save" : "Add patient"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="btn rounded-lg border border-[#E4E4E3] bg-white px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
