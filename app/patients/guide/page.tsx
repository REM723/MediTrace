import Link from "next/link";

export default function GuidePage() {
  const steps: { title: string; body: string }[] = [
    {
      title: "Add a patient",
      body: "From the Patients list, fill in the patient's name (required), age or date of birth, sex, and any notes. Click Add patient. The patient appears in the list immediately.",
    },
    {
      title: "Build the timeline",
      body: "Open the patient. Use the + Symptom, + Prescription, and + Investigation buttons to record entries. Each entry is dated so the AI sees the chronological history. Add as many entries as you have before generating a diagnosis.",
    },
    {
      title: "Upload a lab or imaging report",
      body: "On any investigation entry, click Upload report PDF. MediTrace extracts findings from the text layer automatically. If the PDF is scanned, OCR runs as a fallback.",
    },
    {
      title: "Confirm extracted findings",
      body: "Auto-extracted values are quarantined until you approve them. Click Review findings, check each row against the original report, edit anything wrong, then click Confirm findings. Nothing enters the diagnostic context until confirmed.",
    },
    {
      title: "Generate a diagnosis",
      body: "Click the Generate diagnosis button (top-right of the patient page). MediTrace sends the full timeline to the AI and returns a ranked differential. Red-flag conditions appear first. The disclaimer below the result is always shown. This is decision support, not a verdict.",
    },
    {
      title: "Refine with follow-up questions",
      body: "The AI lists questions that would help narrow the differential. Type your answers and click Submit answers and re-rank. A new report is generated with the answers in context. Repeat as needed.",
    },
    {
      title: "Freeze the report",
      body: "Once you are satisfied, click Freeze this report to lock it. A frozen report cannot be regenerated until you reopen it. Use this to mark the working diagnosis for a visit.",
    },
    {
      title: "Print or export",
      body: "On the diagnosis page, the Print button opens the browser print dialog showing only the report. To export the full patient record (timeline, findings, all diagnoses) as JSON, go back to the patient page and click Export record under the patient's name.",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/patients"
        className="btn inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to dashboard
      </Link>

      <h1 className="mt-6 text-[22px] font-semibold tracking-tight text-[#111110]">How to use MediTrace</h1>
      <p className="mt-2 text-sm text-neutral-500">
        A walkthrough of the core workflow from adding a patient to generating and freezing a differential.
      </p>

      <ol className="mt-10 space-y-8">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-800 text-xs font-semibold text-white">
              {i + 1}
            </div>
            <div className="pt-0.5">
              <h2 className="text-sm font-semibold text-[#111110]">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700">Safety reminder</p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
          MediTrace is decision-support only. Every differential it generates is a ranked list of possibilities produced by an AI model. A licensed physician must review and confirm everything before any clinical action. It is not a cleared medical device.
        </p>
      </div>
    </main>
  );
}
