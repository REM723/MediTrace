"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg, getOrCreateEncounter, today } from "@/lib/db";
import { NO_MEDICINE, type Prescription } from "@/lib/types";

const field = "field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2 text-sm text-[#111110] placeholder:text-neutral-300 disabled:opacity-50";
const lbl = "block text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400 mt-4 first:mt-0";

export default function PrescriptionForm({
  patientId, initial, onDone,
}: { patientId: string; initial?: Prescription; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(initial?.rx_date ?? today());
  const [noMedicine, setNoMedicine] = useState(initial?.medicine === NO_MEDICINE);
  const [medicine, setMedicine] = useState(initial && initial.medicine !== NO_MEDICINE ? initial.medicine : "");
  const [dose, setDose] = useState(initial?.dose ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "");
  const [duration, setDuration] = useState(initial?.duration ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      const encounterId = await getOrCreateEncounter(supabase, patientId, date);
      const row = noMedicine
        ? { encounter_id: encounterId, medicine: NO_MEDICINE, dose: null, frequency: null, duration: null, rx_date: date }
        : { encounter_id: encounterId, medicine: medicine.trim(), dose: dose.trim() || null, frequency: frequency.trim() || null, duration: duration.trim() || null, rx_date: date };
      const { error } = initial
        ? await supabase.from("prescriptions").update(row).eq("id", initial.id)
        : await supabase.from("prescriptions").insert(row);
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
      <h3 className="text-sm font-semibold text-[#111110]">{initial ? "Edit prescription" : "Add prescription"}</h3>
      <label className={lbl} htmlFor="rx-date">Date</label>
      <input id="rx-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      <label className="mt-4 flex items-center gap-2 text-xs text-neutral-600">
        <input type="checkbox" checked={noMedicine} onChange={(e) => setNoMedicine(e.target.checked)} className="rounded" />
        No medicine advised
      </label>
      <label className={lbl} htmlFor="rx-medicine">Medicine</label>
      <input id="rx-medicine" required={!noMedicine} disabled={noMedicine} value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="e.g. Paracetamol" className={field} />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl} htmlFor="rx-dose">Dose</label>
          <input id="rx-dose" disabled={noMedicine} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="500 mg" className={field} />
        </div>
        <div>
          <label className={lbl} htmlFor="rx-freq">Frequency</label>
          <input id="rx-freq" disabled={noMedicine} value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="3x daily" className={field} />
        </div>
        <div>
          <label className={lbl} htmlFor="rx-duration">Duration</label>
          <input id="rx-duration" disabled={noMedicine} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="5 days" className={field} />
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
