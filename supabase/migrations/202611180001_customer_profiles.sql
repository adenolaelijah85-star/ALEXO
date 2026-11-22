create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  addresses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(addresses) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

grant select, insert, update, delete on public.customer_profiles to authenticated;

drop policy if exists "Customers can view their own profile" on public.customer_profiles;
create policy "Customers can view their own profile"
  on public.customer_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Customers can create their own profile" on public.customer_profiles;
create policy "Customers can create their own profile"
  on public.customer_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Customers can update their own profile" on public.customer_profiles;
create policy "Customers can update their own profile"
  on public.customer_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customers can delete their own profile" on public.customer_profiles;
create policy "Customers can delete their own profile"
  on public.customer_profiles for delete to authenticated
  using (auth.uid() = user_id);
