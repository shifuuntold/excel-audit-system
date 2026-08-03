-- AI Audit Analyst — conversation persistence
-- ---------------------------------------------------------------------
-- One ongoing conversation thread per user for the floating AI Assistant,
-- so it survives closing the popup, refreshing the page, and logging back
-- in later (ChatGPT-style), instead of resetting every time the sheet
-- closes. Each message also carries a `feedback` field ("helpful" /
-- "unhelpful" / null) for the thumbs up/down controls.
--
-- One row per user (not one row per message) — the whole thread is stored
-- as a single jsonb array and rewritten on each new message. Simple,
-- and completely fine at the message-count a single user's assistant
-- conversation will ever reach.
-- ---------------------------------------------------------------------

create table if not exists ai_conversations (
    user_id uuid primary key references auth.users(id) on delete cascade,
    messages jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

alter table ai_conversations enable row level security;

drop policy if exists "Users manage their own AI conversation" on ai_conversations;
create policy "Users manage their own AI conversation"
    on ai_conversations
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
