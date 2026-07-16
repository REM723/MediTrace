"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/db";
import ComplaintForm from "./ComplaintForm";
import PrescriptionForm from "./PrescriptionForm";
import InvestigationForm from "./InvestigationForm";
import InvestigationUpload from "./InvestigationUpload";
import type { Complaint, Encounter, Investigation, Prescription } from "@/lib/types";

type Item =
  | { kind: "complaint"; date: string; row: Complaint }
  | { kind: "prescription"; date: string; row: Prescription }
  | { kind: "investigation"; date: string; row: Investigation };

const TABLE = { complaint: "complaints", prescription: "prescriptions", investigation: "investigations" } as const;

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const TYPE_BORDER = {
  complaint: "border-l-amber-400",
  prescription: "border-l-sky-400",
  investigation: "border-l-violet-400",
} as const;

const TYPE_BADGE = {
  complaint: "bg-amber-50 text-amber-700",
  prescription: "bg-sky-50 text-sky-700",
  investigation: "bg-violet-50 text-violet-700",
} as const;

const TYPE_LABEL = { complaint: "Symptom", prescription: "Rx", investigation: "Test" } as const;

const ADD_BUTTON = {
  complaint: { label: "Symptom", dot: "text-amber-500" },
  prescription: { label: "Prescription", dot: "text-sky-500" },
  investigation: { label: "Investigation", dot: "text-violet-500" },
} as const;

export default function Timeline({
  patientId,
  encounters,
}: {
  patientId: string;
  encounters: Encounter[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<Item["kind"] | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items: Item[] = encounters.flatMap((e) => [
    ...e.complaints.map((c) => ({ kind: "complaint" as const, date: c.complaint_date, row: c })),
    ...e.prescriptions.map((p) => ({ kind: "prescription" as const, date: p.rx_date, row: p })),
    ...e.investigations.map((i) => ({ kind: "investigation" as const, date: i.ordered_date, row: i })),
  ]);
  items.sort((a, b) => a.date.localeCompare(b.date));
  const dates = [...new Set(items.map((i) => i.date))];

  async function handleDelete(item: Item) {
    if (!confirm("Remove this entry?")) return;
    setError(null);
    const { error } = await createClient().from(TABLE[item.kind]).delete().eq("id", item.row.id);
    if (error) { setError(errMsg(error)); return; }
    router.refresh();
  }

  function closeForm() { setAdding(null); setEditing(null); }

  function renderForm(kind: Item["kind"], item?: Item) {
    switch (kind) {
      case "complaint":
        return <ComplaintForm patientId={patientId} initial={item?.kind === "complaint" ? item.row : undefined} onDone={closeForm} />;
      case "prescription":
        return <PrescriptionForm patientId={patientId} initial={item?.kind === "prescription" ? item.row : undefined} onDone={closeForm} />;
      case "investigation":
        return <InvestigationForm patientId={patientId} initial={item?.kind === "investigation" ? item.row : undefined} onDone={closeForm} />;
    }
  }

  return (
    <section>
      {/* Header + add buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Timeline</h2>
        {(["complaint", "prescription", "investigation"] as const).map((kind) => (
          <button
            key={kind}
            className="btn group flex items-center gap-1.5 rounded-lg border border-[#E4E4E3] bg-white py-1.5 pl-2.5 pr-3 text-xs font-medium text-neutral-600 hover:border-neutral-300 hover:text-[#111110]"
            onClick={() => { setAdding(kind); setEditing(null); }}
          >
            <span className={`text-sm leading-none ${ADD_BUTTON[kind].dot}`}>+</span>
            {ADD_BUTTON[kind].label}
          </button>
        ))}
      </div>

      {/* Inline add form */}
      {adding && (
        <div className="mt-3 rounded-xl border border-[#E4E4E3] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {renderForm(adding)}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Empty state */}
      {items.length === 0 && !adding && (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#E4E4E3] bg-white/60 py-12 text-center">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
            <rect x="6" y="10" width="36" height="32" rx="5" stroke="#D4D4D3" strokeWidth="1.5"/>
            <path d="M15 6v8M33 6v8" stroke="#D4D4D3" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M6 22h36" stroke="#D4D4D3" strokeWidth="1.5"/>
            <path d="M14 30h20M14 36h14" stroke="#E5E5E4" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="mt-4 text-sm font-medium text-neutral-600">Start building the timeline</p>
          <p className="mt-1 max-w-xs text-xs text-neutral-400">
            Record what happened at each visit. Every entry is dated and grouped automatically.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {(["complaint", "prescription", "investigation"] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => { setAdding(kind); setEditing(null); }}
                className="btn group flex items-center gap-1.5 rounded-lg border border-[#E4E4E3] bg-white py-1.5 pl-2.5 pr-3 text-xs font-medium text-neutral-600 hover:border-neutral-300 hover:text-[#111110]"
              >
                <span className={`text-sm leading-none ${ADD_BUTTON[kind].dot}`}>+</span>
                {ADD_BUTTON[kind].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date-grouped timeline */}
      <ol className="mt-5 space-y-6">
        {dates.map((date) => (
          <li key={date}>
            <div className="flex items-center gap-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-400">
                {formatDate(date)}
              </h3>
              <div className="h-px flex-1 bg-[#F0F0EF]" />
            </div>
            <ul className="mt-2 space-y-2">
              {items
                .filter((i) => i.date === date)
                .map((item) =>
                  editing && editing.row.id === item.row.id ? (
                    <li key={item.row.id} className="rounded-xl border border-[#E4E4E3] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      {renderForm(item.kind, item)}
                    </li>
                  ) : (
                    <li
                      key={item.row.id}
                      className={`overflow-hidden rounded-xl border border-[#E4E4E3] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] border-l-[3px] ${TYPE_BORDER[item.kind]}`}
                    >
                      <div className="flex items-start justify-between gap-3 px-4 py-3">
                        <ItemBody item={item} typeBadge={TYPE_BADGE[item.kind]} typeLabel={TYPE_LABEL[item.kind]} />
                        <div className="flex shrink-0 gap-3 text-xs">
                          <button
                            onClick={() => { setEditing(item); setAdding(null); }}
                            className="btn text-neutral-400 hover:text-neutral-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="btn text-neutral-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {item.kind === "investigation" && (
                        <div className="border-t border-[#F0F0EF] px-4 pb-3 pt-2.5">
                          <InvestigationUpload investigation={item.row} />
                        </div>
                      )}
                    </li>
                  )
                )}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ItemBody({ item, typeBadge, typeLabel }: { item: Item; typeBadge: string; typeLabel: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeBadge}`}>
        {typeLabel}
      </span>

      {item.kind === "complaint" && (
        <>
          <span className="font-medium text-[#111110]">{item.row.symptom_text}</span>
          {item.row.severity && <span className="text-xs text-neutral-400">{item.row.severity}</span>}
          {item.row.symptom_tag && <span className="text-xs text-neutral-300">#{item.row.symptom_tag}</span>}
        </>
      )}

      {item.kind === "prescription" && (
        <>
          <span className="font-medium text-[#111110]">{item.row.medicine}</span>
          {[item.row.dose, item.row.frequency, item.row.duration].filter(Boolean).length > 0 && (
            <span className="text-xs text-neutral-400">
              {[item.row.dose, item.row.frequency, item.row.duration].filter(Boolean).join(", ")}
            </span>
          )}
        </>
      )}

      {item.kind === "investigation" && (
        <span className="font-medium text-[#111110]">{item.row.name}</span>
      )}
    </div>
  );
}
