alter table public."winsAuditSubmissions"
    drop constraint if exists "winsAuditSubmissions_conversation_id_key";

create index if not exists wins_audit_submissions_conversation_id_idx
    on public."winsAuditSubmissions" (conversation_id);
