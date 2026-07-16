import type { SupabaseClient } from "@supabase/supabase-js";

// Encounters are keyed by (patient, date): adding any timeline item on a date
// reuses that date's encounter or creates one.
// ponytail: no locking; a same-millisecond double-submit could create two
// encounters for one date, which is harmless for display and diagnosis.
export async function getOrCreateEncounter(
  supabase: SupabaseClient,
  patientId: string,
  date: string
): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from("encounters")
    .select("id")
    .eq("patient_id", patientId)
    .eq("date", date)
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("encounters")
    .insert({ patient_id: patientId, date })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Best-effort audit trail (§5.5). Never blocks or fails the caller's action;
// a lost audit row must not lose the doctor's work. actor_id must equal the
// current user (enforced by the audit_log RLS insert policy).
export async function logAudit(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null
): Promise<void> {
  const { error } = await supabase
    .from("audit_log")
    .insert({ actor_id: actorId, action, entity, entity_id: entityId });
  if (error) console.error("audit_log write failed:", error.message);
}

// Supabase errors are plain objects, not Error instances.
export function errMsg(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

// Local-timezone yyyy-mm-dd for date input defaults (toISOString is UTC and
// rolls to yesterday for evening users east of Greenwich).
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
