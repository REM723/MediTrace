# MediTrace

A physician-facing longitudinal diagnostic assistant. MediTrace keeps a dated
clinical timeline for each patient (symptoms, prescriptions, investigations)
and generates a ranked differential diagnosis from that history using an LLM.
The output is decision support only. A licensed clinician confirms everything.

## Features

- **Patient records** with a dated, auto-grouped timeline of symptoms, prescriptions, and investigations.
- **Report upload and extraction.** Attach an investigation PDF; findings are extracted (PDF text or OCR fallback) and must be confirmed or edited by the physician before they enter the diagnostic context. No silent trust.
- **Differential diagnosis** generated on a dedicated page. Always a ranked list of possibilities, never a single definitive answer, with emergency and red-flag conditions surfaced prominently.
- **Follow-up Q and A** against a generated report, saved to history.
- **Export** a patient's full record as JSON.
- **Admin panel** at `/admin`, gated by a separate password, showing registered users, patients, diagnosis counts, and the audit log.
- **Disclaimer** shown on every report and near the generate button.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Auth, Storage) with row-level security on every table
- Groq via the OpenAI-compatible API for diagnosis generation
- pdfjs-dist and tesseract.js for report extraction

## Security model

- Every table has row-level security. A row is reachable only through a patient owned by the signed-in user.
- Report PDFs live in a private storage bucket, one folder per user, accessed through signed URLs.
- Secret keys never reach the browser bundle. All LLM calls and service-role database access happen only inside `app/api/**` route handlers.
- The service-role key and the Groq key are server-only.

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only. Never expose in client code.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server-only. https://console.groq.com/keys
GROQ_API_KEY=your-groq-key
GROQ_MODEL_ID=openai/gpt-oss-120b

# Password for the /admin panel.
ADMIN_PASSWORD=choose-a-strong-password
```

### 3. Set up the database

Run the migrations in `supabase/migrations/` against your Supabase project, in
order, using the SQL editor or the Supabase CLI. This creates the tables, RLS
policies, and the private `reports` storage bucket.

In the Supabase dashboard, under Authentication, enable new user signups and
turn off email confirmation if you want accounts to work immediately.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project layout

```
app/
  (auth)/login/             Sign in and sign up
  patients/                 Patient list, detail, timeline, guide
  patients/[id]/diagnose/   Differential diagnosis page
  admin/                    Password-gated admin panel
  api/                      Server routes: diagnose, extract-pdf, export
components/                 Forms, timeline, diagnosis panel
lib/                        Supabase clients, types, db helpers
supabase/migrations/        Schema, RLS, storage
proxy.ts                    Session refresh and route gating
```

## Disclaimer

MediTrace is a clinical decision-support tool. It does not diagnose. Every
suggestion must be reviewed and confirmed by a licensed physician before it
informs any care decision.
