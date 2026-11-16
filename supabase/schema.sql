-- Run ONLY in the new V2.2 Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','teacher')),
  full_name text not null,
  school_name text not null,
  school_key text not null,
  curriculum text not null check (curriculum in ('TN State Board','CBSE')),
  roll_key text,
  class_name text,
  guardian_email text,
  created_at timestamptz not null default now(),
  unique (school_key, roll_key)
);

create table if not exists public.school_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_key text not null,
  approved_by text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.school_admins enable row level security;

create policy "Users can read their own profile"
on public.profiles for select to authenticated using (id = auth.uid());

-- School-admin rows are intentionally not readable/writable from browser clients.
revoke all on public.school_admins from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare
  v_role text;
  v_school text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role','');
  if v_role = 'teacher' then
    v_school := trim(coalesce(new.raw_user_meta_data->>'school_name',''));
    if v_school = '' then return new; end if;
    insert into public.profiles(id,role,full_name,school_name,school_key,curriculum)
    values(new.id,'teacher',coalesce(new.raw_user_meta_data->>'full_name','Teacher'),v_school,lower(regexp_replace(v_school,'\s+',' ','g')),coalesce(new.raw_user_meta_data->>'curriculum','TN State Board'))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_v22 on auth.users;
create trigger on_auth_user_created_v22 after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin provisioning must be done by a trusted project owner after verifying the school.
-- Never allow users to self-insert into school_admins.
