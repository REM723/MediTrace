import { z } from "zod";

// The exact shape the LLM must return (SRS §5.2). This is a trust boundary:
// nothing here is rendered or persisted as a diagnosis until it parses clean.
export const DiagnosisSchema = z.object({
  differential: z
    .array(
      z.object({
        condition: z.string().min(1),
        likelihood: z.enum(["high", "moderate", "low"]),
        supporting_evidence: z.array(z.string()),
        against_or_missing: z.array(z.string()),
        confirmatory_step: z.string(),
        red_flag: z.boolean(),
      })
    )
    .min(1),
  recommended_tests: z.array(
    z.object({
      test: z.string(),
      targets: z.array(z.string()),
      rationale: z.string(),
    })
  ),
  follow_up_questions: z.array(z.string()),
  urgent_warning: z.string().nullable(),
  disclaimer: z.string(),
});

export type Diagnosis = z.infer<typeof DiagnosisSchema>;
export type DdxCandidate = Diagnosis["differential"][number];

// A JSON Schema copy handed to Groq so the model constrains its own output.
// Kept literal (not generated) so the wire contract is readable in one place.
export const DIAGNOSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "differential",
    "recommended_tests",
    "follow_up_questions",
    "urgent_warning",
    "disclaimer",
  ],
  properties: {
    differential: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "condition",
          "likelihood",
          "supporting_evidence",
          "against_or_missing",
          "confirmatory_step",
          "red_flag",
        ],
        properties: {
          condition: { type: "string" },
          likelihood: { type: "string", enum: ["high", "moderate", "low"] },
          supporting_evidence: { type: "array", items: { type: "string" } },
          against_or_missing: { type: "array", items: { type: "string" } },
          confirmatory_step: { type: "string" },
          red_flag: { type: "boolean" },
        },
      },
    },
    recommended_tests: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["test", "targets", "rationale"],
        properties: {
          test: { type: "string" },
          targets: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
      },
    },
    follow_up_questions: { type: "array", items: { type: "string" } },
    urgent_warning: { type: ["string", "null"] },
    disclaimer: { type: "string" },
  },
} as const;
