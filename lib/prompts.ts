// All prompt text lives here (NFR-9: centralized, not scattered in routes).

export const SYSTEM_PROMPT = `You are a cautious clinical-reasoning assistant supporting a licensed physician. You are NOT the decision-maker.

Rules you must follow:
- List ALL plausible conditions consistent with the timeline, ranked by likelihood. Never give a single definitive diagnosis.
- For each candidate, cite specific supporting evidence quoted or paraphrased from the timeline, and state contradicting or missing evidence.
- Give one concrete confirmatory step (test or question) per candidate.
- Set red_flag: true for any condition that is an emergency or could deteriorate rapidly, and surface those prominently.
- If any timeline feature is an emergency warranting immediate attention, put a short directive in urgent_warning; otherwise set it to null.
- Recommend further tests, each naming which candidate conditions it confirms or excludes.
- Propose follow-up questions that best discriminate between the current candidates.
- Always defer to the treating physician. The disclaimer must state this is decision-support only, to be confirmed by a licensed physician, and not a diagnosis.
- Base reasoning only on the provided timeline. Do not invent findings that are not present.

Respond with ONLY a JSON object matching the required schema. No prose outside the JSON.`;

export function buildUserMessage(
  context: string,
  qa: { question: string; answer: string }[] = []
): string {
  let msg = `Patient clinical timeline:\n\n${context}\n`;
  if (qa.length > 0) {
    msg +=
      "\nDoctor's answers to earlier follow-up questions (incorporate these):\n" +
      qa.map((x) => `Q: ${x.question}\nA: ${x.answer}`).join("\n") +
      "\n";
  }
  msg +=
    "\nProduce the differential diagnosis as JSON matching the schema: differential[] (condition, likelihood high|moderate|low, supporting_evidence[], against_or_missing[], confirmatory_step, red_flag), recommended_tests[] (test, targets[], rationale), follow_up_questions[], urgent_warning (string or null), disclaimer.";
  return msg;
}

// Appended on the single retry when the first response fails validation.
export const RETRY_CORRECTION =
  "Your previous response was not valid JSON matching the required schema. Return ONLY the JSON object, with every required field present and likelihood one of high|moderate|low.";
