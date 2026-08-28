-- Requests from the private-access form on getsoffo.com.
--
-- Written only by the Vercel endpoint (api/access.js) with the service role.
-- RLS is on and there are no policies, so anon and authenticated can see and
-- write nothing at all; the service role bypasses RLS and is the only way in.

create table if not exists public.access_requests (
  id bigint generated always as identity primary key,
  email text not null check (position('@' in email) > 1 and length(email) <= 200),
  name text not null check (length(name) between 1 and 120),
  organization text check (length(organization) <= 160),
  x_handle text check (x_handle ~ '^[A-Za-z0-9_]{1,80}$'),
  source text not null default 'getsoffo.com',
  created_at timestamptz not null default now()
);

comment on table public.access_requests is
  'Private-access requests from the getsoffo.com form. Inserted by the Vercel endpoint using the service role.';

-- the only way this table is ever read: newest first
create index if not exists access_requests_created_at_idx
  on public.access_requests (created_at desc);

alter table public.access_requests enable row level security;
alter table public.access_requests force row level security;

-- nothing reaches it through the publishable key
revoke all on table public.access_requests from anon, authenticated;
