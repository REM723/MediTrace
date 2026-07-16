# Product Requirements Document (PRD)
## MediTrace — Longitudinal AI Diagnostic Assistant

**Version:** 1.0 · **Status:** Draft · **Owner:** Product

> **Safety framing (read first).** MediTrace is a **physician-facing clinical decision-support** product. It surfaces *possibilities and reasoning* over a patient's timeline; it never issues an autonomous or final diagnosis, and it always defers to a licensed clinician. It is **not** a regulated/cleared medical device. This framing constrains every design decision below.

---

## 1. Summary
MediTrace lets a doctor build a patient's clinical timeline — dated complaints, prescriptions, and lab/investigation results (including uploaded PDF reports that are auto-extracted) — and then generates a **differential diagnosis report** covering all plausible conditions with evidence-based reasoning. Phase 2 turns it into a conversation: the tool asks the doctor discriminating questions, refines the ranked diagnoses, and recommends further tests.

Built entirely on **free tiers**: **Groq API** (LLM reasoning), **Supabase** (auth, Postgres, storage), and **Vercel/Netlify** (hosting).

---

## 2. Problem & Motivation
Diagnosis is longitudinal, but data is scattered across visit notes, prescriptions, and separate lab PDFs. Clinicians must mentally stitch a timeline and hold many hypotheses at once. Symptoms weeks apart (a June GI bleed, a July fever cluster) can be causally related yet easy to view in isolation.

**Problem statement:** Clinicians lack a lightweight tool that assembles a patient's full timeline and produces a transparent, evidence-linked differential — with a way to refine it interactively — without expensive EMR/AI platforms.

---

## 3. Goals & Non-Goals

### 3.1 Goals
- **G1:** Capture complaints, prescriptions, and investigations on a single dated timeline.
- **G2:** Auto-extract structured findings from uploaded lab/report PDFs.
- **G3:** Generate a transparent, all-possibilities differential diagnosis with evidence for and against each candidate.
- **G4 (Phase 2):** Refine the diagnosis through an adaptive Q&A loop and suggest further tests.
- **G5:** Run at **zero cost** on free tiers.
- **G6:** Be safe by design — advisory only, human-in-the-loop, emergency flagging.

### 3.2 Non-Goals
- Not autonomous diagnosis or treatment; not prescribing/dispensing.
- Not a cleared/regulated medical device (v1).
- No EMR/HL7/FHIR integration, billing, or insurance in v1.
- No patient self-service diagnosis (a limited patient-report view is future work).

---

## 4. Personas
- **Dr. Anand — GP (primary).** Wants a fast second-pair-of-eyes differential over a messy timeline; must stay in control; skeptical of black boxes, so demands visible reasoning.
- **Priya — clinic data-entry (secondary).** Enters complaints and uploads report PDFs quickly; low tolerance for fiddly forms.
- **Admin (internal).** Manages users and watches free-tier quota.

---

## 5. User Stories (with priority)
1. **P1** — As a doctor, I add a dated complaint so the timeline reflects when symptoms appeared.
2. **P1** — As staff, I record what medicine was prescribed on a given date.
3. **P1** — As a doctor, I record an investigation and upload its PDF result so its findings are captured automatically.
4. **P1** — As a doctor, I review and correct auto-extracted findings before they influence the diagnosis.
5. **P1** — As a doctor, I generate a differential diagnosis listing *all* plausible conditions with reasoning.
6. **P1** — As a doctor, I see a clear disclaimer and any emergency red flags on every report.
7. **P2** — As a doctor, I answer follow-up questions and watch the diagnosis re-rank.
8. **P2** — As a doctor, I get recommended next tests with a rationale for each.
9. **P1** — As a doctor, I export the report to share/print.
10. **P1** — As an admin, I trust that one user cannot see another's patients.

---

## 6. Scope by Phase

### Phase 1 — Timeline + Differential (MVP)
Patient CRUD · dated complaints/prescriptions/investigations · PDF upload + extraction + confirm · one-shot DDx with evidence · disclaimer + red-flag flagging · report export · auth + RLS + audit.

### Phase 2 — Interactive Refinement
Discriminating follow-up questions · answer capture · DDx re-ranking · further-test recommendations · Q&A history · confirm/rule-out to freeze a report.

### Future (post-v1)
Patient self-report view · EMR/FHIR import · vision-model reading of scanned images/charts · multi-doctor collaboration · analytics.

---

## 7. Detailed Feature Requirements

### 7.1 Timeline capture
Chronological, per-patient view mixing complaints, prescriptions, and investigations. Same-date multi-complaint supported (e.g., the 15 July cluster). Inline add/edit with required date pickers; "no medicine advised" is a valid record.

### 7.2 PDF ingestion & extraction
Upload to a **private Supabase Storage bucket**. Detect text vs. scanned PDF; parse text-based PDFs directly, OCR fallback for scans. Structure into key–value results, units, abnormal flags, and impression text. **The doctor confirms/edits before findings enter the diagnostic context** — no silent trust of extraction.

### 7.3 Differential diagnosis engine
Assemble the full timeline into a structured context and call Groq. Output = ranked candidates, each with likelihood band, supporting evidence (quoted from timeline), contradicting/missing evidence, and a confirmatory next step. **All plausible possibilities shown, never a single verdict.** Emergency/red-flag conditions surfaced first. Every report stores its exact input snapshot + model ID for reproducibility.

### 7.4 Interactive refinement (Phase 2)
Generate the few questions that best separate current candidates; capture answers; re-run and re-rank; recommend tests that confirm/exclude specific hypotheses (with rationale); keep Q&A history in context across iterations; allow confirm/rule-out to freeze the report.

### 7.5 Reporting
Printable/PDF export with timeline, findings, DDx, Q&A, disclaimer.

---

## 8. UX Flow (happy path)
```
Select/create patient
   → Add complaint (date)            ┐
   → Add prescription (date)         ├─ builds Timeline
   → Add investigation + upload PDF  ┘
        → auto-extract → confirm findings
   → "Generate diagnosis"
        → ranked Differential + red flags + disclaimer
   → [Phase 2] Answer follow-up questions
        → refined Differential + recommended tests
   → Export report
```
Layout: left = patients; center = timeline; right = live DDx panel.

---

## 9. Technical Architecture (free stack)

| Layer | Choice | Why / free tier |
|---|---|---|
| Frontend | Next.js (React) | SPA + serverless routes in one app; free on Vercel |
| Hosting | Vercel or Netlify | Generous free tier; serverless functions included |
| Auth | Supabase Auth | Email/password, JWT, free |
| Database | Supabase Postgres | Relational timeline model + RLS, free tier |
| File storage | Supabase Storage | Private bucket for PDFs, signed URLs, free tier |
| PDF text | `pdf-parse`/`pdfjs` (text) + Tesseract OCR (scans) | Runs in serverless route; free/open-source |
| LLM | **Groq API** | Fast, OpenAI-compatible, free tier; serves open models |
| LLM abstraction | Thin provider wrapper | Swap Groq ↔ other OpenAI-compatible provider by config |

**Secret handling:** Groq key + Supabase service key live only in serverless env vars — never in the browser bundle. All privileged calls (Groq, service-key writes) go through server routes.

**Groq call shape:** OpenAI-compatible `chat/completions`, low temperature, JSON-schema-constrained response, model ID from an env var (verify the current Groq model catalogue at build time, since it changes).

---

## 10. Data Model (see SRS §5.1 for full DDL sketch)
Core tables: `patients`, `encounters`, `complaints`, `prescriptions`, `investigations`, `findings`, `diagnoses` (with `input_snapshot_json`, `ddx_json`, `model_id`, `phase`), `qa_history`, `audit_log`. RLS keyed on `owner_id` isolates each user's patients.

---

## 11. LLM / Prompt Design
- **System prompt:** cautious clinical-reasoning assistant; lists *all* plausible conditions; never a single definitive diagnosis; cites timeline evidence for and against each; flags emergencies; always defers to a licensed physician.
- **User message:** structured timeline (complaints, prescriptions, confirmed findings) + Phase-2 Q&A history.
- **Response:** constrained JSON (see SRS §5.2) — `differential[]`, `recommended_tests[]`, `follow_up_questions[]`, `urgent_warning`, `disclaimer`.
- **Cost control:** one batched call per regeneration; cache last report; regenerate only on data change or explicit request.

---

## 12. Success Metrics
- **Activation:** % of new users who generate ≥1 diagnosis in first session.
- **Engagement (P2):** avg. refinement rounds per case; % cases reaching a confirmed/ruled-out state.
- **Extraction quality:** % of uploaded PDFs whose findings are accepted with no edits.
- **Trust:** doctor-rated usefulness of DDx reasoning (thumbs / 1–5) per report.
- **Reliability:** Groq/extraction error rate; p95 DDx latency (< ~10 s target).
- **Cost:** stay within free-tier quotas (0 spend).

---

## 13. Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| **Clinical harm from over-trust** | High | Advisory-only framing, disclaimer everywhere, red-flag surfacing, human-in-loop, no single verdict |
| Hallucinated/incorrect DDx | High | Low temperature, evidence-must-cite-timeline prompt, physician confirmation required, store input snapshot |
| Wrong PDF extraction | Med | Mandatory human confirmation step before findings enter diagnosis |
| Privacy/legal (health data) | High | RLS isolation, consent attestation, export + hard-delete, audit log, HTTPS, secrets server-side |
| Free-tier limits hit | Med | Batch calls, cache reports, cleanup stale PDFs, quota monitoring; provider abstraction to migrate |
| Groq model/catalogue changes | Med | Model ID as config; verify at build; provider-agnostic wrapper |
| Not a cleared device / regulatory | High | Explicit non-device disclaimer; position as internal decision-support pilot; consult counsel before clinical deployment |

---

## 14. Milestones / Roadmap
- **M0 — Setup:** Supabase project, schema + RLS, Groq key, Next.js scaffold, auth.
- **M1 — Timeline (P1):** patient CRUD + complaints/prescriptions/investigations + timeline UI.
- **M2 — PDF pipeline (P1):** upload, extraction (text + OCR), confirm-findings UI.
- **M3 — Diagnosis (P1):** context assembly, Groq call, schema validation, DDx UI, disclaimer, snapshot persistence, export. **← MVP ship.**
- **M4 — Refinement (P2):** follow-up questions, answer capture, re-ranking, test recommendations, confirm/rule-out.
- **M5 — Hardening:** audit log, delete/export, quota monitoring, error handling/retries.

---

## 15. Open Questions
- Multi-doctor sharing of a patient in v1, or strict single-owner?
- Ship a small curated medical reference (RAG) to ground the model, or rely on the LLM's parametric knowledge for the pilot?
- Vision-model reading of scanned images/charts in v1 or defer?
- Depth of consent/compliance needed for the target deployment region before any real patient data is used.

---

## 16. Appendix — Worked example (from the brief)
- **10 Jun:** fever → paracetamol.
- **24 Jun:** red colour in stool → endoscopy + colonoscopy ordered; result PDFs uploaded & extracted; any medicine advised recorded.
- **15 Jul:** severe body pain + fever + headache + constipation.

**Phase 1:** MediTrace returns a ranked differential — GI bleeding sources (ulcer / polyp / colitis / hemorrhoids) weighed against the actual endoscopy/colonoscopy findings, plus systemic/enteric infection considered for the July fever cluster — each candidate with supporting and contradicting evidence and a confirmatory step, red flags highlighted, disclaimer attached.

**Phase 2:** the tool asks discriminating questions (blood colour/amount, weight loss, travel/food history, medication response), the doctor answers, the differential re-ranks, and specific next tests are proposed with rationale — always for the physician to confirm.
