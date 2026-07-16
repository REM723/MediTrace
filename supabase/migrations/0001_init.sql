-- MediTrace schema, RLS, and storage bucket.
-- Security model: every row is reachable only through a patient owned by
-- auth.uid(). Child tables inherit ownership via joins in their policies.

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  dob_or_age text,
  sex text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  date date not null,
  type text not null default 'visit',
  notes text
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  symptom_text text not null,
  symptom_tag text,
  severity text,
  complaint_date date not null
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  medicine text not null,
  dose text,
  frequency text,
  duration text,
  rx_date date not null
);

create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  name text not null,
  ordered_date date not null,
  pdf_path text,
  extraction_status text not null default 'none'
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  key text,
  value text,
  unit text,
  abnormal_flag boolean,
  impression_text text,
  -- Safety rule: extracted findings enter the diagnostic context only after
  -- the physician confirms them. Defaults to false, always.
  confirmed_by_user boolean not null default false
);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  created_at timestamptz not null default now(),
  input_snapshot_json jsonb not null,
  ddx_json jsonb not null,
  model_id text not null,
  phase int not null default 3
);

create table public.qa_history (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references public.diagnoses (id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now()
);

-- Postgres does not index FK columns automatically and every RLS policy
-- below joins through them.
create index on public.encounters (patient_id);
create index on public.complaints (encounter_id);
create index on public.prescriptions (encounter_id);
create index on public.investigations (encounter_id);
create index on public.findings (investigation_id);
create index on public.diagnoses (patient_id);
create index on public.qa_history (diagnosis_id);
create index on public.patients (owner_id);

alter table public.patients enable row level security;
alter table public.encounters enable row level security;
alter table public.complaints enable row level security;
alter table public.prescriptions enable row level security;
alter table public.investigations enable row level security;
alter table public.findings enable row level security;
alter table public.diagnoses enable row level security;
alter table public.qa_history enable row level security;
alter table public.audit_log enable row level security;

create policy "own patients" on public.patients for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "own encounters" on public.encounters for all
  using (exists (
    select 1 from public.patients p
    where p.id = patient_id and p.owner_id = (select auth.uid())))
  with check (exists (
    select 1 from public.patients p
    where p.id = patient_id and p.owner_id = (select auth.uid())));

create policy "own complaints" on public.complaints for all
  using (exists (
    select 1 from public.encounters e
    join public.patients p on p.id = e.patient_id
    where e.id = encounter_id and p.owner_id = (select auth.uid())))
  with check (exists (
    select 1 from public.encounters e
    join public.patients p on p.id = e.patient_id
    where e.id = encounter_id and p.owner_id = (select auth.uid())));

create policy "own prescriptions" on public.prescriptions for all
  using (exists (
    select 1 from public.encounters e
    join public.patients p on p.id = e.patient_id
    where e.id = encounter_id and p.owner_id = (select auth.uid())))
  with check (exists (
    select 1 from public.encounters e
    join public.patients p on p.id = e.patient_id
    where e.id = encounter_id and p.owner_id = (select auth.uid())));

create policy "own investigations" on public.investigations for all
  using (exists (
    select 1 from public.encounters e
    join public.patients p on p.id = e.patient_id
    where e.id = encounter_id and p.owner_id = (select auth.uid())))
  with check (exists (
    select 1 from public.encounters e
    join public.patients p on p.id = e.patient_id
    where e.id = encounter_id and p.owner_id = (select auth.uid())));

create policy "own findings" on public.findings for all
  using (exists (
    select 1 from public.investigations i
    join public.encounters e on e.id = i.encounter_id
    join public.patients p on p.id = e.patient_id
    where i.id = investigation_id and p.owner_id = (select auth.uid())))
  with check (exists (
    select 1 from public.investigations i
    join public.encounters e on e.id = i.encounter_id
    join public.patients p on p.id = e.patient_id
    where i.id = investigation_id and p.owner_id = (select auth.uid())));

create policy "own diagnoses" on public.diagnoses for all
  using (exists (
    select 1 from public.patients p
    where p.id = patient_id and p.owner_id = (select auth.uid())))
  with check (exists (
    select 1 from public.patients p
    where p.id = patient_id and p.owner_id = (select auth.uid())));

create policy "own qa_history" on public.qa_history for all
  using (exists (
    select 1 from public.diagnoses d
    join public.patients p on p.id = d.patient_id
    where d.id = diagnosis_id and p.owner_id = (select auth.uid())))
  with check (exists (
    select 1 from public.diagnoses d
    join public.patients p on p.id = d.patient_id
    where d.id = diagnosis_id and p.owner_id = (select auth.uid())));

-- Audit log: append-only for the actor, readable only by the actor.
create policy "audit insert own" on public.audit_log for insert
  with check (actor_id = (select auth.uid()));
create policy "audit read own" on public.audit_log for select
  using (actor_id = (select auth.uid()));

-- Private bucket for report PDFs. Objects live under <user_id>/... and only
-- that user can touch them; access from the app is via signed URLs.
insert into storage.buckets (id, name, public) values ('reports', 'reports', false);

create policy "reports owner all" on storage.objects for all to authenticated
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
