-- FR-22: a report can be frozen (confirmed/ruled-out) so it is no longer a draft.
alter table public.diagnoses add column status text not null default 'draft';
