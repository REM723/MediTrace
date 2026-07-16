"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errMsg, logAudit } from "@/lib/db";
import Disclaimer from "./Disclaimer";
import type { Diagnosis, DdxCandidate } from "@/lib/schema";

type QA = { question: string; answer: string };
type Stored = {
  id: string;
  diagnosis: Diagnosis;
  created_at: string;
  model: string;
  status: string;
} | null;

const LIKELIHOOD_ORDER = { high: 0, moderate: 1, low: 2 } as const;

const likelihoodStyle = {
  high: "bg-red-100 text-red-700",
  moderate: "bg-amber-100 text-amber-700",
  low: "bg-neutral-100 text-neutral-500",
} as const;

export default function DdxPanel({
  patientId,
  patientName,
  initial,
  initialQa,
}: {
  patientId: string;
  patientName: string;
  initial: Stored;
  initialQa: QA[];
}) {
  const [report, setReport] = useState<Stored>(initial);
  const [answered, setAnswered] = useState<QA[]>(initialQa);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frozen = report?.status === "frozen";

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Generation failed");
      setReport({ id: body.id, diagnosis: body.diagnosis, created_at: body.created_at, model: body.model, status: body.status });
      setAnswered([]);
      setAnswers({});
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswers() {
    if (!report) return;
    const pairs = Object.entries(answers)
      .map(([i, answer]) => ({
        question: report.diagnosis.follow_up_questions[Number(i)],
        answer: answer.trim(),
      }))
      .filter((p) => p.answer && p.question);
    if (pairs.length === 0) { setError("Answer at least one question first."); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: insErr } = await createClient()
        .from("qa_history")
        .insert(pairs.map((p) => ({ diagnosis_id: report.id, ...p })));
      if (insErr) throw insErr;
      await generate();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  async function setStatus(status: "frozen" | "draft") {
    if (!report) return;
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("diagnoses").update({ status }).eq("id", report.id);
    if (error) { setError(errMsg(error)); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await logAudit(supabase, user.id, status === "frozen" ? "freeze" : "reopen", "diagnosis", report.id);
    }
    setReport({ ...report, status });
  }

  const d = report?.diagnosis;
  const ordered = d
    ? [...d.differential].sort(
        (a, b) => Number(b.red_flag) - Number(a.red_flag) || LIKELIHOOD_ORDER[a.likelihood] - LIKELIHOOD_ORDER[b.likelihood]
      )
    : [];

  return (
    <div>
      {/* Panel header */}
      <div className="no-print flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Diagnosis</p>
        {report && (
          <button
            onClick={() => window.print()}
            className="btn flex items-center gap-1 rounded-lg border border-[#E4E4E3] bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 9V2h12v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
              <path d="M6 17H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Print
          </button>
        )}
      </div>

      <div className="no-print mt-3">
        <Disclaimer />

        {frozen ? (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800">
            <span className="font-medium">Report frozen</span>
            <button onClick={() => setStatus("draft")} className="btn underline hover:text-green-700">
              Reopen
            </button>
          </div>
        ) : (
          <button
            onClick={generate}
            disabled={busy}
            className="btn mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-40"
          >
            {busy ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analyzing...
              </>
            ) : report ? "Regenerate diagnosis" : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Generate diagnosis
              </>
            )}
          </button>
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {!report && !busy && (
          <div className="mt-8 flex flex-col items-center py-6 text-center">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
              <circle cx="20" cy="20" r="18" stroke="#E4E4E3" strokeWidth="1.5"/>
              <path d="M13 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#D4D4D3" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="20" cy="26" r="1.5" fill="#D4D4D3"/>
              <path d="M20 22v-3" stroke="#D4D4D3" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="mt-3 text-xs text-neutral-400">Generate a diagnosis from the current timeline</p>
          </div>
        )}
      </div>

      {d && (
        <div id="ddx-report" className="mt-5">
          {/* Print-only header */}
          <div className="mb-4 hidden print:block">
            <h1 className="text-lg font-semibold">MediTrace differential: {patientName}</h1>
            {frozen && <p className="text-sm text-green-700">Frozen report</p>}
          </div>

          {/* Urgent warning */}
          {d.urgent_warning && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-red-600" aria-hidden>
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-xs font-medium text-red-800">{d.urgent_warning}</p>
            </div>
          )}

          {/* Differential */}
          <ol className="space-y-2.5">
            {ordered.map((c, i) => (
              <Candidate key={i} c={c} rank={i + 1} />
            ))}
          </ol>

          {/* Recommended tests */}
          {d.recommended_tests.length > 0 && (
            <section className="mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Recommended tests</p>
              <ul className="mt-2 space-y-2">
                {d.recommended_tests.map((t, i) => (
                  <li key={i} className="rounded-xl border border-[#E4E4E3] bg-white p-3">
                    <div className="text-sm font-medium text-[#111110]">{t.test}</div>
                    <div className="mt-0.5 text-xs text-neutral-500">{t.rationale}</div>
                    {t.targets.length > 0 && (
                      <div className="mt-1 text-[11px] text-neutral-400">Targets: {t.targets.join(", ")}</div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Answered Q&A */}
          {answered.length > 0 && (
            <section className="mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Answered</p>
              <ul className="mt-2 space-y-2.5">
                {answered.map((qa, i) => (
                  <li key={i}>
                    <div className="text-[11px] text-neutral-400">{qa.question}</div>
                    <div className="mt-0.5 text-sm text-[#111110]">{qa.answer}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Follow-up questions */}
          {!frozen && d.follow_up_questions.length > 0 && (
            <section className="no-print mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Follow-up questions</p>
              <div className="mt-2 space-y-3">
                {d.follow_up_questions.map((q, i) => (
                  <div key={i}>
                    <label className="block text-xs text-neutral-600">{q}</label>
                    <input
                      value={answers[i] ?? ""}
                      onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                      placeholder="Your answer"
                      className="field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2 text-sm text-[#111110] placeholder:text-neutral-300"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={submitAnswers}
                disabled={busy}
                className="btn mt-3 w-full rounded-xl border border-[#E4E4E3] bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-[#F7F7F6] disabled:opacity-40"
              >
                {busy ? "Working..." : "Submit answers and re-rank"}
              </button>
            </section>
          )}

          {/* Print-only question list */}
          {d.follow_up_questions.length > 0 && (
            <section className="mt-6 hidden print:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Follow-up questions</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-neutral-600">
                {d.follow_up_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </section>
          )}

          {/* Freeze button */}
          {!frozen && (
            <button
              onClick={() => setStatus("frozen")}
              className="no-print btn mt-6 w-full rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800 hover:bg-green-100"
            >
              Freeze this report
            </button>
          )}

          <div className="mt-5">
            <Disclaimer text={d.disclaimer} />
          </div>
          <p className="mt-2 text-[10px] text-neutral-400">
            {new Date(report!.created_at).toLocaleString("en-GB")} · {report!.model}
            {frozen ? " · frozen" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function Candidate({ c, rank }: { c: DdxCandidate; rank: number }) {
  return (
    <li className={`overflow-hidden rounded-xl border p-4 ${
      c.red_flag ? "border-red-200 bg-red-50/60" : "border-[#E4E4E3] bg-white"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-medium text-neutral-400">{rank}.</span>
          <span className="ml-1.5 text-sm font-semibold text-[#111110]">{c.condition}</span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {c.red_flag && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              Red flag
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            c.red_flag
              ? { high: "bg-red-200 text-red-800", moderate: "bg-red-100 text-red-700", low: "bg-red-100 text-red-600" }[c.likelihood]
              : { high: "bg-red-100 text-red-700", moderate: "bg-amber-100 text-amber-700", low: "bg-neutral-100 text-neutral-500" }[c.likelihood]
          }`}>
            {c.likelihood}
          </span>
        </div>
      </div>

      <EvidenceList label="Supporting" items={c.supporting_evidence} tone="text-neutral-600" />
      <EvidenceList label="Against / missing" items={c.against_or_missing} tone="text-neutral-400" />

      <div className="mt-2.5 text-xs">
        <span className="font-medium text-neutral-600">Confirm with: </span>
        <span className="text-neutral-500">{c.confirmatory_step}</span>
      </div>
    </li>
  );
}

function EvidenceList({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-300">{label}</div>
      <ul className={`mt-1 list-disc space-y-0.5 pl-3.5 text-[11px] ${tone}`}>
        {items.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </div>
  );
}
