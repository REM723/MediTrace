import type { Encounter, Finding } from "@/lib/types";
import { NO_MEDICINE } from "@/lib/types";

// Serializes a patient's timeline into the structured text the LLM reasons
// over. SAFETY (FR-12/FR-13): only findings the physician confirmed are
// included; unconfirmed extraction output never reaches the model.
export function assembleContext(
  patient: { name: string; dob_or_age: string | null; sex: string | null; notes: string | null },
  encounters: Encounter[]
): string {
  const lines: string[] = [];
  lines.push("PATIENT");
  lines.push(
    `- ${[patient.dob_or_age && `age/DOB ${patient.dob_or_age}`, patient.sex]
      .filter(Boolean)
      .join(", ") || "demographics not recorded"}`
  );
  if (patient.notes) lines.push(`- Notes: ${patient.notes}`);

  const dated = [...encounters].sort((a, b) => a.date.localeCompare(b.date));

  lines.push("");
  lines.push("TIMELINE (chronological)");
  for (const e of dated) {
    const parts: string[] = [];
    for (const c of e.complaints) {
      parts.push(
        `  Symptom: ${c.symptom_text}` +
          [c.severity && ` (severity: ${c.severity})`, c.symptom_tag && ` [${c.symptom_tag}]`]
            .filter(Boolean)
            .join("")
      );
    }
    for (const p of e.prescriptions) {
      if (p.medicine === NO_MEDICINE) {
        parts.push("  Prescription: no medicine advised");
      } else {
        parts.push(
          `  Prescription: ${p.medicine}` +
            [p.dose, p.frequency, p.duration].filter(Boolean).map((x) => ` ${x}`).join("")
        );
      }
    }
    for (const inv of e.investigations) {
      const confirmed = (inv.findings ?? []).filter((f) => f.confirmed_by_user);
      parts.push(`  Investigation: ${inv.name}${describeFindings(confirmed)}`);
    }
    if (parts.length === 0) continue;
    lines.push(`${e.date}:`);
    lines.push(...parts);
  }

  return lines.join("\n");
}

function describeFindings(findings: Finding[]): string {
  if (findings.length === 0) return " (no confirmed findings)";
  const out: string[] = [];
  for (const f of findings) {
    if (f.impression_text) {
      out.push(`    Impression: ${f.impression_text}`);
    } else if (f.key) {
      const val = [f.value, f.unit].filter(Boolean).join(" ");
      out.push(`    ${f.key}: ${val || "n/a"}${f.abnormal_flag ? " (abnormal)" : ""}`);
    }
  }
  return "\n" + out.join("\n");
}

// A stable digest of what actually influenced the diagnosis, used both as the
// persisted input_snapshot_json (FR-17) and as the cache key: regenerate only
// when this changes or the user forces it (SRS §5.4).
export function snapshot(
  patient: { name: string; dob_or_age: string | null; sex: string | null; notes: string | null },
  encounters: Encounter[],
  qa: { question: string; answer: string }[] = []
) {
  return {
    patient,
    encounters: encounters.map((e) => ({
      date: e.date,
      complaints: e.complaints.map((c) => ({
        symptom_text: c.symptom_text,
        severity: c.severity,
        symptom_tag: c.symptom_tag,
      })),
      prescriptions: e.prescriptions.map((p) => ({
        medicine: p.medicine,
        dose: p.dose,
        frequency: p.frequency,
        duration: p.duration,
      })),
      investigations: e.investigations.map((inv) => ({
        name: inv.name,
        findings: (inv.findings ?? [])
          .filter((f) => f.confirmed_by_user)
          .map((f) => ({
            key: f.key,
            value: f.value,
            unit: f.unit,
            abnormal_flag: f.abnormal_flag,
            impression_text: f.impression_text,
          })),
      })),
    })),
    qa,
  };
}
