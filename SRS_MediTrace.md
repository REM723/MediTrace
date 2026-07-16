# Software Requirements Specification (SRS)
## Project: MediTrace — Longitudinal AI Diagnostic Assistant

**Version:** 1.0
**Status:** Draft
**Document type:** SRS (IEEE 830 aligned)

> **Medical safety notice.** MediTrace is a clinical **decision-support** tool intended to be used **by or under the supervision of a licensed physician**. It does not make autonomous diagnoses, does not replace a clinician's judgment, and is **not** a regulated/cleared medical device. Every output is a ranked set of *possibilities* with reasoning, to be confirmed by a qualified doctor.

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for **MediTrace**, a web application that collects a patient's longitudinal clinical data — complaints (symptoms with dates), prescribed medicines, and lab/investigation results (including uploaded PDF reports) — and uses a Large Language Model (via the Groq API) to produce a **differential diagnosis report** listing all plausible diseases with supporting reasoning. A second phase adds an **interactive refinement loop** in which the system asks the doctor follow-up questions and recommends further tests.

### 1.2 Scope
MediTrace covers:
- Structured, timeline-based capture of patient complaints.
- Capture of prescribed medications per visit/date.
- Upload and automatic data extraction from lab/investigation PDFs (e.g., endoscopy, colonoscopy, blood panels).
- LLM-driven differential diagnosis generation over the full timeline.
- Phase 2: adaptive question–answer refinement with the doctor and suggested next investigations.
- Persistence, authentication, and audit of all patient data via Supabase.

Out of scope: prescribing/dispensing, autonomous treatment decisions, billing, insurance, and integration with hospital EMR/HL7/FHIR systems (listed as future work).

### 1.3 Definitions, Acronyms, Abbreviations
- **Complaint:** A patient-reported symptom with an associated date.
- **Encounter/Visit:** A dated interaction containing complaints, prescriptions, and/or investigations.
- **Differential diagnosis (DDx):** A ranked list of candidate conditions consistent with the data.
- **Groq API:** Hosted, low-latency inference API serving open LLMs (OpenAI-compatible schema).
- **Supabase:** Backend-as-a-service providing Postgres, Auth, Storage, and Row-Level Security (RLS).
- **RLS:** Row-Level Security — per-row access control enforced in Postgres.
- **OCR:** Optical Character Recognition, for scanned PDFs.
- **RAG:** Retrieval-Augmented Generation.

### 1.4 References
- IEEE Std 830-1998, Recommended Practice for SRS.
- Groq API documentation (OpenAI-compatible chat completions).
- Supabase documentation (Auth, Postgres, Storage, RLS).

### 1.5 Overview
Section 2 gives the overall product description. Section 3 lists specific functional and interface requirements. Section 4 details system features. Section 5 covers data and non-functional requirements. Section 6 holds appendices (prompt design, sample walkthrough).

---

## 2. Overall Description

### 2.1 Product Perspective
MediTrace is a new, standalone web application. It is a thin, cost-free stack:

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Next.js React SPA)               │
│  Timeline UI · Complaint/Med forms · PDF upload · DDx report  │
└───────────────┬──────────────────────────────┬───────────────┘
                │ HTTPS                          │ HTTPS
       ┌────────▼─────────┐            ┌─────────▼──────────┐
       │  Supabase        │            │  Serverless API    │
       │  Auth / Postgres │            │  routes (Vercel)   │
       │  Storage (PDFs)  │            │  · PDF extraction  │
       │  RLS policies    │            │  · Groq calls      │
       └──────────────────┘            └─────────┬──────────┘
                                                  │ HTTPS
                                        ┌─────────▼──────────┐
                                        │   Groq API (LLM)   │
                                        │  DDx + Q&A engine  │
                                        └────────────────────┘
```

All chosen components have free tiers: Supabase (free project), Groq (free API tier), Vercel/Netlify (free hosting).

### 2.2 Product Functions (summary)
1. Create/manage patient records.
2. Add dated complaints to a patient timeline.
3. Add dated prescriptions (medicine, dose, frequency, duration).
4. Add dated investigations; upload result PDFs; auto-extract structured findings.
5. Generate a differential diagnosis report from the full timeline.
6. (Phase 2) Run an interactive Q&A loop with the doctor to refine the DDx.
7. (Phase 2) Recommend further tests and re-rank the DDx as answers arrive.
8. Store, retrieve, version, and audit all of the above.

### 2.3 User Classes and Characteristics
- **Doctor (primary):** Enters/reviews clinical data, answers refinement questions, is the decision authority. Medium technical skill.
- **Clinic staff / data-entry (secondary):** Enters complaints and uploads reports. Basic technical skill.
- **Patient (optional, limited):** May self-report complaints via a restricted view (future).
- **Administrator:** Manages users, monitors usage/quota. Technical.

### 2.4 Operating Environment
- Client: modern desktop/mobile browser (Chrome, Edge, Firefox, Safari), last two major versions.
- Backend: serverless functions (Node runtime) on Vercel/Netlify free tier.
- Data: Supabase-hosted Postgres 15+, Supabase Storage.
- External: Groq API over HTTPS.

### 2.5 Design & Implementation Constraints
- **Zero-cost constraint:** Only free tiers may be used; the design must respect Groq rate/token limits and Supabase storage/row limits.
- **Secrets:** Groq API key and Supabase service key must live only in server-side environment variables, never in the browser bundle.
- **PDF handling:** Text-based PDFs parsed directly; scanned PDFs need OCR fallback.
- **LLM determinism:** Diagnosis calls run at low temperature and must return schema-valid JSON.
- **No autonomous action:** Output is advisory only; a human must confirm.

### 2.6 Assumptions and Dependencies
- Groq API availability and its current model catalogue (model IDs verified at build time, since offerings change).
- Supabase free-tier limits are sufficient for a pilot dataset.
- Uploaded PDFs are legitimate lab reports; no adversarial content.
- Users have consent/authority to process the patient data (see §5.5).

---

## 3. Specific Requirements

Requirement IDs: **FR-x** functional, **IR-x** interface, **NFR-x** non-functional. Priority: (P1) Phase-1 core, (P2) Phase-2.

### 3.1 Functional Requirements

**Patient & timeline**
- **FR-1 (P1):** The system shall let an authenticated user create a patient with name/identifier, age, sex, and optional notes.
- **FR-2 (P1):** The system shall present a chronological timeline of all encounters for a selected patient.

**Complaints**
- **FR-3 (P1):** The system shall let the user add a complaint with: free-text symptom description, a structured symptom tag (optional), severity (mild/moderate/severe), and a **date** (required).
- **FR-4 (P1):** The system shall support multiple complaints on the same date (e.g., "severe body pain, fever, headache, constipation" on 15 July).
- **FR-5 (P1):** The system shall allow editing and soft-deletion of complaints (with audit trail).

**Prescriptions**
- **FR-6 (P1):** The system shall let the user add a prescription with medicine name, dose, frequency, duration, and prescribing date, linked to an encounter.
- **FR-7 (P1):** The system shall allow "no medicine advised" to be recorded for an encounter (e.g., investigation-only visit).

**Investigations & PDF extraction**
- **FR-8 (P1):** The system shall let the user record an investigation (name, e.g., endoscopy/colonoscopy/CBC) with a date.
- **FR-9 (P1):** The system shall accept a PDF upload for an investigation and store it in Supabase Storage.
- **FR-10 (P1):** The system shall extract text from text-based PDFs and, for scanned PDFs, run OCR fallback.
- **FR-11 (P1):** The system shall parse extracted text into structured findings (key–value results, impression/conclusion text, abnormal-flag detection).
- **FR-12 (P1):** The system shall show the extracted findings for user confirmation/correction before they enter the diagnostic context.

**Diagnosis (Phase 1)**
- **FR-13 (P1):** The system shall assemble the full patient timeline (complaints + prescriptions + confirmed investigation findings) into a structured clinical context.
- **FR-14 (P1):** The system shall call the Groq LLM to produce a **differential diagnosis** containing, for each candidate condition: name, likelihood band (high/moderate/low), supporting evidence from the timeline, contradicting/absent evidence, and recommended confirmatory step.
- **FR-15 (P1):** The system shall present **all** plausible possibilities, not a single answer, ordered by likelihood.
- **FR-16 (P1):** The system shall attach a visible disclaimer to every report stating it is decision-support requiring physician confirmation.
- **FR-17 (P1):** The system shall persist each generated report with a timestamp and the exact input snapshot used (for auditability/reproducibility).

**Refinement loop (Phase 2)**
- **FR-18 (P2):** The system shall generate targeted follow-up questions for the doctor, chosen to best discriminate between the current candidate conditions.
- **FR-19 (P2):** The system shall accept the doctor's answers and re-run diagnosis, producing an updated, re-ranked DDx.
- **FR-20 (P2):** The system shall recommend further tests/investigations with a stated rationale (which hypotheses each test confirms or rules out).
- **FR-21 (P2):** The system shall maintain the Q&A history as part of the diagnostic context across iterations.
- **FR-22 (P2):** The system shall let the doctor mark a diagnosis as confirmed/ruled-out, freezing the report.

**Reporting**
- **FR-23 (P1):** The system shall let the user export a report (PDF/print view) including timeline, findings, DDx, and disclaimer.

### 3.2 External Interface Requirements

- **IR-1 (UI):** A single-page timeline view is the hub: left = patient list; center = chronological encounters; right = current DDx panel.
- **IR-2 (UI):** Forms for complaint, prescription, and investigation shall be modal/inline with date pickers and validation.
- **IR-3 (UI):** PDF upload shall show progress, extraction status, and an editable extracted-findings table.
- **IR-4 (API — Groq):** Server routes shall call Groq's OpenAI-compatible chat-completions endpoint with a system prompt, structured user context, low temperature, and a JSON-schema-constrained response. The concrete model ID shall be a configurable environment variable.
- **IR-5 (API — Supabase):** The client shall use the Supabase JS SDK for auth and reads/writes; privileged operations (Groq calls, service-key access) shall run only in serverless routes.
- **IR-6 (Storage):** PDFs shall be stored in a private Supabase Storage bucket accessed via signed URLs.

### 3.3 System Features (detailed) — see §4.

### 3.4 Non-Functional Requirements

- **NFR-1 (Performance):** A DDx generation request shall return within ~10 s under normal Groq latency; the UI shall show a streaming/loading state.
- **NFR-2 (Scalability):** The design shall operate within free-tier quotas for at least a small clinic pilot (order of hundreds of patients, thousands of encounters).
- **NFR-3 (Reliability):** Failed Groq/extraction calls shall be retried with backoff and surfaced clearly; no silent failures.
- **NFR-4 (Security):** All data access shall be gated by Supabase Auth + RLS so a user only sees permitted patients; secrets never reach the client. All traffic over HTTPS.
- **NFR-5 (Privacy/compliance):** Patient data is sensitive health data; the system shall minimize data, support deletion, and log access (see §5.5).
- **NFR-6 (Auditability):** Every diagnosis is stored with its exact input snapshot and model/version metadata.
- **NFR-7 (Usability):** A doctor shall be able to add a complaint and regenerate a DDx in ≤ 3 clicks.
- **NFR-8 (Portability):** LLM provider abstraction shall allow swapping Groq for another OpenAI-compatible provider with config changes only.
- **NFR-9 (Maintainability):** Prompts, schemas, and model IDs shall be centralized/versioned, not scattered in code.
- **NFR-10 (Safety):** The model shall be instructed to avoid definitive single diagnoses, flag red-flag/emergency symptoms, and always defer to a clinician.

---

## 4. System Features (functional detail)

### 4.1 Timeline capture
**Description:** Capture the longitudinal record.
**Stimulus/response:** User selects patient → adds dated complaint/prescription/investigation → item appears on timeline instantly.
**Requirements:** FR-1..FR-9.

### 4.2 PDF ingestion & extraction
**Description:** Turn an uploaded report PDF into structured, confirmable findings.
**Flow:** upload → store → detect text vs. scanned → extract (parser or OCR) → LLM/heuristic structuring → user confirms → findings become diagnostic context.
**Requirements:** FR-9..FR-12; IR-3, IR-6.

### 4.3 Differential diagnosis engine
**Description:** Produce all plausible diagnoses with reasoning.
**Flow:** assemble context → Groq call (JSON schema) → validate → render ranked DDx → persist snapshot.
**Requirements:** FR-13..FR-17; IR-4.

### 4.4 Interactive refinement (Phase 2)
**Description:** Iteratively converge the DDx via doctor Q&A and test suggestions.
**Flow:** DDx → system asks discriminating questions → doctor answers → re-rank → suggest tests → repeat until confirmed.
**Requirements:** FR-18..FR-22.

### 4.5 Report export
**Requirements:** FR-23.

---

## 5. Data Requirements & Supporting Info

### 5.1 Logical data model (Supabase/Postgres)
```
users            (id, email, role, created_at)              -- via Supabase Auth
patients         (id, owner_id→users, name, dob/age, sex, notes, created_at)
encounters       (id, patient_id→patients, date, type, notes)
complaints       (id, encounter_id→encounters, symptom_text, symptom_tag,
                  severity, complaint_date)
prescriptions    (id, encounter_id→encounters, medicine, dose, frequency,
                  duration, rx_date)
investigations   (id, encounter_id→encounters, name, ordered_date,
                  pdf_path, extraction_status)
findings         (id, investigation_id→investigations, key, value, unit,
                  abnormal_flag, impression_text, confirmed_by_user)
diagnoses        (id, patient_id→patients, created_at, input_snapshot_json,
                  ddx_json, model_id, phase)
qa_history       (id, diagnosis_id→diagnoses, question, answer, created_at)  -- P2
audit_log        (id, actor_id, action, entity, entity_id, at)
```
All patient-linked tables carry RLS policies keyed on `owner_id`.

### 5.2 Diagnosis output schema (JSON returned by Groq)
```json
{
  "differential": [
    {
      "condition": "string",
      "likelihood": "high|moderate|low",
      "supporting_evidence": ["timeline items ..."],
      "against_or_missing": ["..."],
      "confirmatory_step": "test/question to confirm or exclude",
      "red_flag": true
    }
  ],
  "recommended_tests": [
    { "test": "string", "targets": ["condition ..."], "rationale": "string" }
  ],
  "follow_up_questions": ["string"],
  "urgent_warning": "string|null",
  "disclaimer": "Decision-support only; confirm with a licensed physician."
}
```

### 5.3 Prompt strategy (see Appendix A)
System prompt fixes the model as a cautious clinical-reasoning assistant that: lists all plausible conditions, never gives a single definitive diagnosis, cites timeline evidence, flags emergencies, and always defers to a physician. User message carries the structured timeline + Q&A history. Response constrained to the §5.2 schema at low temperature.

### 5.4 Free-tier budget notes
- Groq: batch the entire timeline into one call per regeneration to conserve request quota; cache last report; only regenerate on data change or explicit request.
- Supabase: store PDFs in Storage (not DB); keep extracted text, not raw images, in rows; periodic cleanup of stale uploads.

### 5.5 Privacy, consent, and legal
- Treat all records as sensitive personal health information.
- Obtain user attestation of consent/authority before storing patient data.
- Provide export and hard-delete of a patient's full record.
- Log access in `audit_log`.
- Display the medical disclaimer prominently and on every report; state clearly the tool is not a cleared medical device and not a substitute for professional care.

---

## 6. Appendices

### Appendix A — Sample walkthrough (matches the brief)
Timeline entered:
- **10 Jun:** complaint = fever. Rx = paracetamol.
- **24 Jun:** complaint = red colour in stool. Investigations ordered = endoscopy, colonoscopy (result PDFs uploaded, findings extracted). Any medicine advised recorded here.
- **15 Jul:** complaints = severe body pain, fever, headache, constipation.

Phase-1 output: a ranked DDx (e.g., GI bleeding sources such as ulcer/polyp/colitis/hemorrhoids weighed against the endoscopy/colonoscopy findings; enteric/systemic infection considered for the July fever cluster), each with supporting/contradicting evidence and a confirmatory next step — all flagged for physician confirmation, with any red-flag symptoms (e.g., significant GI bleeding) highlighted.

Phase-2: system asks discriminating questions (e.g., blood colour/quantity, weight loss, travel history), the doctor answers, the DDx re-ranks, and specific further tests are proposed with rationale.

### Appendix B — Acceptance criteria (Phase 1)
- Given the Appendix-A timeline, the system produces a ranked DDx with ≥1 supporting evidence item per candidate, a disclaimer, and a persisted input snapshot.
- Uploading a text PDF yields an editable findings table before the data enters diagnosis.
- All patient data is inaccessible to a different authenticated user (RLS verified).
