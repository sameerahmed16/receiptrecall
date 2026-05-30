-- ============================================================================
-- ReceiptRecall — full database schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses "if not exists" / "drop policy if exists" throughout.
-- ============================================================================

-- 1. Extensions ----------------------------------------------------------------
create extension if not exists vector;

-- 2. Tables --------------------------------------------------------------------

-- receipts: one row per uploaded receipt/screenshot
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  image_url text,                 -- path in Supabase storage
  merchant text,
  merchant_normalized text,       -- "WAL-MART #1234" -> "Walmart"
  txn_date date,
  subtotal numeric,
  tax numeric,
  total numeric,
  payment_method text,
  raw_text text,                  -- full text the model read
  source_type text,               -- 'photo' | 'screenshot' | 'pdf'
  confidence numeric,             -- 0-1, how sure the extraction is
  math_ok boolean,                -- did line items + tax = total?
  created_at timestamptz default now()
);

-- line_items: individual products on a receipt
create table if not exists line_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid references receipts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text,
  category text,                  -- 'Groceries','Dining','Transport','Subscription',...
  quantity numeric default 1,
  unit_price numeric,
  total_price numeric,
  embedding vector(768)           -- meaning-vector of description, for matching/learning
);

-- category_corrections: learn from user fixes
create table if not exists category_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  description text,
  corrected_category text,
  embedding vector(768),
  created_at timestamptz default now()
);

-- subscriptions: detected recurring charges
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  merchant text,
  amount numeric,
  cadence text,                   -- 'monthly' | 'weekly' | 'annual'
  last_seen date,
  next_expected date,
  active boolean default true,
  dismissed boolean default false,
  source text not null default 'auto'  -- 'auto' (detected) | 'manual' (user-added)
);

-- chat history for the assistant
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text,                      -- 'user' | 'assistant'
  content text,
  created_at timestamptz default now()
);

-- Helpful indexes
create index if not exists receipts_user_date_idx on receipts (user_id, txn_date desc);
create index if not exists line_items_user_idx on line_items (user_id);
create index if not exists line_items_receipt_idx on line_items (receipt_id);
create index if not exists chat_user_time_idx on chat_messages (user_id, created_at);

-- 3. Row Level Security --------------------------------------------------------
-- Every table: a user may only ever touch their own rows.
alter table receipts             enable row level security;
alter table line_items           enable row level security;
alter table category_corrections enable row level security;
alter table subscriptions        enable row level security;
alter table chat_messages        enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'receipts','line_items','category_corrections','subscriptions','chat_messages'
  ]
  loop
    execute format('drop policy if exists "own_select" on %I;', t);
    execute format('drop policy if exists "own_insert" on %I;', t);
    execute format('drop policy if exists "own_update" on %I;', t);
    execute format('drop policy if exists "own_delete" on %I;', t);

    execute format(
      'create policy "own_select" on %I for select using (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_insert" on %I for insert with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_update" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_delete" on %I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- 4. Storage bucket for receipt images ----------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Storage RLS: files live under a folder named after the user's id, e.g.
-- "receipts/<user_id>/<file>". Each user only reaches their own folder.
drop policy if exists "receipts_own_read"   on storage.objects;
drop policy if exists "receipts_own_insert" on storage.objects;
drop policy if exists "receipts_own_delete" on storage.objects;

create policy "receipts_own_read" on storage.objects
  for select using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts_own_delete" on storage.objects
  for delete using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Vector match function (used by the learning categorizer in Phase 3) -------
-- Returns the nearest past correction for a given description embedding.
create or replace function match_category_correction(
  query_embedding vector(768),
  match_user_id uuid,
  similarity_threshold float default 0.68  -- calibrated for gemini-embedding-001 768-dim
)
returns table (corrected_category text, similarity float)
language sql stable
set search_path = public  -- pin search_path (security hardening)
as $$
  select
    cc.corrected_category,
    1 - (cc.embedding <=> query_embedding) as similarity
  from category_corrections cc
  where cc.user_id = match_user_id
    and cc.embedding is not null
    and 1 - (cc.embedding <=> query_embedding) >= similarity_threshold
  order by cc.embedding <=> query_embedding
  limit 1;
$$;
