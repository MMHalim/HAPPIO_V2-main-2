create table if not exists public."winsAuditSubmissions" (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    conversation_id text not null unique,
    agent_name text not null,
    taker_name text,
    url text,
    channel text,
    sme_answer text,
    sme_name text,
    sme_following_process text,
    monitoring_type text,
    interaction_related_to text,
    final_score text not null,
    agent_email text not null,
    certification text check (certification in ('Yes', 'No')),
    calibration text check (calibration in ('Yes', 'No')),
    ojt text check (ojt in ('Yes', 'No')),
    ticket_status text,
    sales text check (sales in ('Yes', 'No')),
    sales_comments text,
    retained_yes_no text check (retained_yes_no in ('Yes', 'No')),
    fitness_fluency text check (fitness_fluency in ('Yes', 'No')),
    comments_sme_related text,
    result_status text not null check (result_status in ('PASS', 'FAIL')),
    brand_energy_protocol text check (brand_energy_protocol in ('Yes', 'No')),
    brand_energy_protocol_comment text,
    discovery_history_review text check (discovery_history_review in ('Yes', 'No')),
    discovery_history_review_comment text,
    clarity_and_concise_explaination text check (clarity_and_concise_explaination in ('Yes', 'No')),
    clarity_and_concise_explaination_comment text,
    human_engagement_soft_skills text check (human_engagement_soft_skills in ('Yes', 'No')),
    human_engagement_soft_skills_comment text,
    value_positioning_objection_handling text check (value_positioning_objection_handling in ('Yes', 'No')),
    value_positioning_objection_handling_comment text,
    tailored_concessions_alternatives text check (tailored_concessions_alternatives in ('Yes', 'No')),
    tailored_concessions_alternatives_comment text,
    closing_fcr text check (closing_fcr in ('Yes', 'No')),
    closing_fcr_comment text,
    product_awareness text check (product_awareness in ('Yes', 'No')),
    product_awareness_comment text,
    brand_representation_ownership text check (brand_representation_ownership in ('Yes', 'No')),
    brand_representation_ownership_comment text,
    process_awareness text check (process_awareness in ('Yes', 'No')),
    process_awareness_comment text,
    verfication text check (verfication in ('Yes', 'No')),
    verfication_comment text,
    documentation_crm_updates text check (documentation_crm_updates in ('Yes', 'No')),
    documentation_crm_updates_comment text
);

create index if not exists wins_audit_submissions_created_at_idx
    on public."winsAuditSubmissions" (created_at desc);

create index if not exists wins_audit_submissions_agent_name_idx
    on public."winsAuditSubmissions" (agent_name);

create index if not exists wins_audit_submissions_result_status_idx
    on public."winsAuditSubmissions" (result_status);

grant select, insert, update on public."winsAuditSubmissions" to anon, authenticated;
grant usage, select on sequence public."winsAuditSubmissions_id_seq" to anon, authenticated;

alter table public."winsAuditSubmissions" enable row level security;

drop policy if exists "winsAuditSubmissions_select" on public."winsAuditSubmissions";
drop policy if exists "winsAuditSubmissions_insert" on public."winsAuditSubmissions";
drop policy if exists "winsAuditSubmissions_update" on public."winsAuditSubmissions";

create policy "winsAuditSubmissions_select"
on public."winsAuditSubmissions"
for select
to anon, authenticated
using (true);

create policy "winsAuditSubmissions_insert"
on public."winsAuditSubmissions"
for insert
to anon, authenticated
with check (true);

create policy "winsAuditSubmissions_update"
on public."winsAuditSubmissions"
for update
to anon, authenticated
using (true)
with check (true);
