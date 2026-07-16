"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/db";
import type { Finding } from "@/lib/types";

type Row = { key: string; value: string; unit: string; abnormal: boolean };

const cell = "field w-full rounded-md border border-[#E4E4E3] bg-white px-2 py-1 text-xs text-[#111110]";

export default function FindingsEditor({
  investigationId, initial, onDone,
}: { investigationId: string; initial: Finding[]; onDone: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    initial.filter((f) => f.impression_text === null).map((f) => ({
      key: f.key ?? "", value: f.value ?? "", unit: f.unit ?? "", abnormal: f.abnormal_flag === true,
    }))
  );
  const [impression, setImpression] = useState(initial.find((f) => f.impression_text !== null)?.impression_text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setRow(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      const kept = rows.filter((r) => r.key.trim() !== "");
      const payload = [
        ...kept.map((r) => ({
          investigation_id: investigationId,
          key: r.key.trim(), value: r.value.trim() || null, unit: r.unit.trim() || null,
          abnormal_flag: r.abnormal, impression_text: null, confirmed_by_user: true,
        })),
        ...(impression.trim() ? [{
          investigation_id: investigationId,
          key: "Impression", value: null, unit: null, abnormal_flag: null,
          impression_text: impression.trim(), confirmed_by_user: true,
        }] : []),
      ];
      const { error: delErr } = await supabase.from("findings").delete().eq("investigation_id", investigationId);
      if (delErr) throw delErr;
      if (payload.length > 0) {
        const { error: insErr } = await supabase.from("findings").insert(payload);
        if (insErr) throw insErr;
      }
      await supabase.from("investigations").update({ extraction_status: "extracted" }).eq("id", investigationId);
      router.refresh();
      onDone();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#E4E4E3] bg-[#F9F9F8] p-4">
      <p className="text-[11px] text-neutral-500">
        Review each value against the original report. Edit or remove anything incorrect, then confirm. Nothing here is used for diagnosis until confirmed.
      </p>

      <table className="mt-3 w-full border-separate border-spacing-1">
        <thead>
          <tr className="text-left text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-400">
            <th className="w-2/5">Parameter</th>
            <th>Value</th>
            <th>Unit</th>
            <th className="w-16 text-center">Abnormal</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input className={cell} value={r.key} onChange={(e) => setRow(i, { key: e.target.value })} /></td>
              <td><input className={cell} value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} /></td>
              <td><input className={cell} value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} /></td>
              <td className="text-center">
                <input type="checkbox" checked={r.abnormal} onChange={(e) => setRow(i, { abnormal: e.target.checked })} />
              </td>
              <td className="text-center">
                <button type="button" title="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="btn text-neutral-300 hover:text-red-500">
                  &#10005;
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" onClick={() => setRows([...rows, { key: "", value: "", unit: "", abnormal: false }])} className="btn mt-1.5 text-[11px] text-neutral-400 underline hover:text-neutral-700">
        Add row
      </button>

      <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Impression</label>
      <textarea
        rows={2}
        value={impression}
        onChange={(e) => setImpression(e.target.value)}
        className="field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-2.5 py-2 text-xs text-[#111110]"
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={handleConfirm} className="btn rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-900 disabled:opacity-40">
          {busy ? "Saving" : "Confirm findings"}
        </button>
        <button type="button" onClick={onDone} className="btn rounded-lg border border-[#E4E4E3] bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
