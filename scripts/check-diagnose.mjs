// Offline schema validation checks (schema.ts only imports zod, so it loads
// in bare node). Context-assembly safety + the full round-trip are covered by
// check-diagnose-route.mjs against the live server.
import assert from "node:assert";
import { DiagnosisSchema } from "../lib/schema.ts";

const good = {
  differential: [{
    condition: "Sigmoid ulcer", likelihood: "high",
    supporting_evidence: ["red colour in stool 24 Jun"], against_or_missing: [],
    confirmatory_step: "biopsy", red_flag: true,
  }],
  recommended_tests: [{ test: "CBC", targets: ["anemia"], rationale: "assess blood loss" }],
  follow_up_questions: ["How much blood?"], urgent_warning: null,
  disclaimer: "Decision-support only.",
};
assert.ok(DiagnosisSchema.safeParse(good).success, "valid payload should pass");

const badLikelihood = structuredClone(good);
badLikelihood.differential[0].likelihood = "very-high";
assert.ok(!DiagnosisSchema.safeParse(badLikelihood).success, "invalid likelihood must fail");

const empty = structuredClone(good);
empty.differential = [];
assert.ok(!DiagnosisSchema.safeParse(empty).success, "empty differential must fail");

const missingField = structuredClone(good);
delete missingField.differential[0].confirmatory_step;
assert.ok(!DiagnosisSchema.safeParse(missingField).success, "missing required field must fail");

console.log("PASS: schema accepts valid, rejects bad likelihood / empty / missing field");
