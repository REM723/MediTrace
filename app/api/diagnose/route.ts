import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/db";
import { assembleContext, snapshot } from "@/lib/timeline";
import { SYSTEM_PROMPT, buildUserMessage, RETRY_CORRECTION } from "@/lib/prompts";
import { chatJson, modelId, type ChatMessage } from "@/lib/groq";
import { DiagnosisSchema } from "@/lib/schema";
import type { Encounter } from "@/lib/types";

// Groq latency + one possible retry; NFR-1 targets ~10s.
export const maxDuration = 60;

// Tolerate a model that wraps JSON in ```json fences despite instructions.
function parseLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("No JSON object in model response");
    return JSON.parse(m[0]);
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { patientId } = (await req.json()) as { patientId?: string };
  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 });
  }

  // RLS-scoped read: user can only pull their own patient + timeline + Q&A.
  const [{ data: patient }, { data: encounters }, { data: qaRows }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
    supabase
      .from("encounters")
      .select("*, complaints(*), prescriptions(*), investigations(*, findings(*))")
      .eq("patient_id", patientId)
      .order("date"),
    // All prior Q&A for this patient, oldest first (FR-21: carried across
    // iterations). Inner join scopes to this patient's diagnoses under RLS.
    supabase
      .from("qa_history")
      .select("question, answer, created_at, diagnoses!inner(patient_id)")
      .eq("diagnoses.patient_id", patientId)
      .order("created_at"),
  ]);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const encs = (encounters ?? []) as Encounter[];
  const qa = (qaRows ?? []).map((r) => ({ question: r.question, answer: r.answer }));
  const context = assembleContext(patient, encs);
  const snap = snapshot(patient, encs, qa);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(context, qa) },
  ];

  // Call, validate, and retry once with a correction before giving up (FR-14).
  let diagnosis;
  try {
    const first = await chatJson(messages);
    const parsed = DiagnosisSchema.safeParse(parseLoose(first));
    if (parsed.success) {
      diagnosis = parsed.data;
    } else {
      const retry = await chatJson([
        ...messages,
        { role: "assistant", content: first },
        { role: "user", content: RETRY_CORRECTION },
      ]);
      const reparsed = DiagnosisSchema.safeParse(parseLoose(retry));
      if (!reparsed.success) {
        console.error("diagnose: invalid after retry", reparsed.error.issues);
        return NextResponse.json(
          { error: "The model returned an unreadable diagnosis. Try regenerating." },
          { status: 502 }
        );
      }
      diagnosis = reparsed.data;
    }
  } catch (err) {
    console.error("diagnose failed:", err);
    return NextResponse.json({ error: "Diagnosis generation failed" }, { status: 502 });
  }

  // Persist with exact input snapshot + model id for reproducibility (FR-17).
  const model = modelId();
  const { data: saved, error: saveErr } = await supabase
    .from("diagnoses")
    .insert({
      patient_id: patientId,
      input_snapshot_json: snap,
      ddx_json: diagnosis,
      model_id: model,
      phase: 3,
    })
    .select()
    .single();
  if (saveErr) {
    console.error("diagnose persist failed:", saveErr);
    return NextResponse.json({ error: "Could not save diagnosis" }, { status: 500 });
  }

  await logAudit(supabase, user.id, "generate_diagnosis", "patient", patientId);

  return NextResponse.json({
    diagnosis,
    id: saved.id,
    created_at: saved.created_at,
    model,
    status: saved.status,
  });
}
