begin;

create extension if not exists pgcrypto;

-- Policy-only helpers and integrity triggers live outside exposed API schemas.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.household_member_role as enum ('owner', 'member');
create type public.chore_frequency as enum ('once', 'daily', 'weekly', 'monthly');
create type public.assignment_status as enum ('pending', 'completed', 'skipped');
create type public.swap_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
create type public.rule_status as enum ('draft', 'pending_approval', 'active', 'archived');
create type public.shopping_priority as enum ('low', 'normal', 'high');
create type public.shopping_status as enum ('needed', 'purchased', 'removed');
create type public.note_status as enum ('active', 'archived');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  avatar_url text,
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  timezone text not null default 'Asia/Tokyo',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.household_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_members_household_user_key unique (household_id, user_id)
);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text,
  area text check (area is null or char_length(trim(area)) between 2 and 80),
  frequency public.chore_frequency not null default 'weekly',
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chores_id_household_key unique (id, household_id)
);

create table public.chore_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  chore_id uuid not null,
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  scheduled_for date not null,
  due_at timestamptz,
  status public.assignment_status not null default 'pending',
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chore_assignments_chore_household_fkey
    foreign key (chore_id, household_id)
    references public.chores (id, household_id) on delete cascade,
  constraint chore_assignments_chore_date_key unique (chore_id, scheduled_for),
  constraint chore_assignments_id_household_key unique (id, household_id),
  constraint chore_assignments_completion_check check (
    (status = 'completed' and completed_at is not null and completed_by is not null)
    or (status <> 'completed' and completed_at is null and completed_by is null)
  )
);

create table public.task_swaps (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  assignment_id uuid not null,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  offered_to uuid not null references public.profiles (id) on delete restrict,
  status public.swap_status not null default 'pending',
  message text check (message is null or char_length(message) <= 500),
  responded_at timestamptz,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_swaps_assignment_household_fkey
    foreign key (assignment_id, household_id)
    references public.chore_assignments (id, household_id) on delete cascade,
  constraint task_swaps_distinct_users_check check (requested_by <> offered_to),
  constraint task_swaps_response_check check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create table public.house_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  content text not null check (char_length(trim(content)) between 2 and 4000),
  status public.rule_status not null default 'draft',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_rules_id_household_key unique (id, household_id)
);

create table public.rule_approvals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  rule_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rule_approvals_rule_household_fkey
    foreign key (rule_id, household_id)
    references public.house_rules (id, household_id) on delete cascade,
  constraint rule_approvals_rule_user_key unique (rule_id, user_id)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  quantity integer not null default 1 check (quantity between 1 and 999),
  priority public.shopping_priority not null default 'normal',
  status public.shopping_status not null default 'needed',
  created_by uuid not null references public.profiles (id) on delete restrict,
  purchased_by uuid references public.profiles (id) on delete set null,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_items_purchase_check check (
    (status = 'purchased' and purchased_by is not null and purchased_at is not null)
    or (status <> 'purchased' and purchased_by is null and purchased_at is null)
  )
);

create table public.waste_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  waste_type text not null check (char_length(trim(waste_type)) between 2 and 100),
  weekday smallint not null check (weekday between 0 and 6),
  collection_time time,
  next_collection_date date,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waste_schedules_type_day_key unique (household_id, waste_type, weekday)
);

create table public.house_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 160),
  content text not null check (char_length(trim(content)) between 1 and 5000),
  status public.note_status not null default 'active',
  is_pinned boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index household_members_user_id_idx on public.household_members (user_id);
create index household_members_household_role_idx on public.household_members (household_id, role);
create index households_created_by_idx on public.households (created_by);
create index chores_household_active_idx on public.chores (household_id, is_active);
create index chores_created_by_idx on public.chores (created_by);
create index chore_assignments_household_date_idx on public.chore_assignments (household_id, scheduled_for);
create index chore_assignments_assignee_status_idx on public.chore_assignments (assignee_id, status);
create index chore_assignments_created_by_idx on public.chore_assignments (created_by);
create index chore_assignments_completed_by_idx on public.chore_assignments (completed_by) where completed_by is not null;
create index task_swaps_household_status_idx on public.task_swaps (household_id, status);
create index task_swaps_assignment_idx on public.task_swaps (assignment_id);
create index task_swaps_requested_by_idx on public.task_swaps (requested_by);
create index task_swaps_offered_to_status_idx on public.task_swaps (offered_to, status);
create unique index task_swaps_one_pending_per_assignment_idx
  on public.task_swaps (assignment_id) where status = 'pending';
create index house_rules_household_status_idx on public.house_rules (household_id, status);
create index house_rules_created_by_idx on public.house_rules (created_by);
create index rule_approvals_household_idx on public.rule_approvals (household_id);
create index rule_approvals_user_idx on public.rule_approvals (user_id);
create index shopping_items_household_status_idx on public.shopping_items (household_id, status);
create index shopping_items_created_by_idx on public.shopping_items (created_by);
create index shopping_items_purchased_by_idx on public.shopping_items (purchased_by) where purchased_by is not null;
create index waste_schedules_household_date_idx on public.waste_schedules (household_id, next_collection_date);
create index waste_schedules_created_by_idx on public.waste_schedules (created_by);
create index house_notes_household_status_idx on public.house_notes (household_id, status, is_pinned);
create index house_notes_created_by_idx on public.house_notes (created_by);
create index house_notes_updated_by_idx on public.house_notes (updated_by);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Penghuni'
  );

  if char_length(profile_name) < 2 then
    profile_name := 'Penghuni';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, left(profile_name, 80));
  return new;
end;
$$;

create function public.handle_new_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = auth.uid()
  );
$$;

create function private.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
  );
$$;

create function private.shares_household_with(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as viewer
    join public.household_members as target
      on target.household_id = viewer.household_id
    where viewer.user_id = auth.uid()
      and target.user_id = target_profile_id
  );
$$;

-- Trigger arguments name identity columns only; ordinary business fields remain editable.
create function private.enforce_immutable_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  immutable_column text;
begin
  foreach immutable_column in array tg_argv loop
    if (to_jsonb(new) -> immutable_column)
      is distinct from (to_jsonb(old) -> immutable_column) then
      raise exception 'Column %.% is immutable', tg_table_name, immutable_column
        using errcode = '22000';
    end if;
  end loop;

  return new;
end;
$$;

-- The actor and allowed result are derived from OLD participants, never client-supplied NEW IDs.
create function private.enforce_task_swap_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'pending' then
    raise exception 'A resolved task swap cannot be changed'
      using errcode = '22000';
  end if;

  if auth.uid() = old.requested_by and new.status = 'cancelled' then
    null;
  elsif auth.uid() = old.offered_to and new.status in ('accepted', 'rejected') then
    null;
  else
    raise exception 'Invalid task swap transition for the current user'
      using errcode = '42501';
  end if;

  new.responded_at := now();
  return new;
end;
$$;

comment on function private.enforce_immutable_columns() is
  'Rejects UPDATE changes to identity columns supplied as trigger arguments.';
comment on function private.enforce_task_swap_transition() is
  'Allows only requester cancellation or original recipient acceptance/rejection from pending.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_household_created
  after insert on public.households
  for each row execute function public.handle_new_household();

-- Identity columns are immutable; each trigger lists only non-business fields.
create trigger profiles_enforce_identity before update on public.profiles
  for each row execute function private.enforce_immutable_columns('id', 'created_at');
create trigger households_enforce_identity before update on public.households
  for each row execute function private.enforce_immutable_columns('id', 'created_by', 'created_at');
create trigger household_members_enforce_identity before update on public.household_members
  for each row execute function private.enforce_immutable_columns('id', 'household_id', 'user_id', 'joined_at');
create trigger chores_enforce_identity before update on public.chores
  for each row execute function private.enforce_immutable_columns('id', 'household_id', 'created_by', 'created_at');
create trigger chore_assignments_enforce_identity before update on public.chore_assignments
  for each row execute function private.enforce_immutable_columns('id', 'household_id', 'chore_id', 'created_by', 'created_at');
create trigger task_swaps_enforce_identity before update on public.task_swaps
  for each row execute function private.enforce_immutable_columns(
    'id', 'household_id', 'assignment_id', 'requested_by', 'offered_to', 'requested_at'
  );
create trigger task_swaps_validate_transition before update on public.task_swaps
  for each row execute function private.enforce_task_swap_transition();
create trigger house_rules_enforce_identity before update on public.house_rules
  for each row execute function private.enforce_immutable_columns('id', 'household_id', 'created_by', 'created_at');
create trigger rule_approvals_enforce_identity before update on public.rule_approvals
  for each row execute function private.enforce_immutable_columns('id', 'household_id', 'rule_id', 'user_id', 'created_at');
create trigger shopping_items_enforce_identity before update on public.shopping_items
  for each row execute function private.enforce_immutable_columns('id', 'household_id', 'created_by', 'created_at');
create trigger waste_schedules_enforce_identity before update on public.waste_schedules
  for each row execute function private.enforce_immutable_columns('id', 'household_id', 'created_by', 'created_at');
create trigger house_notes_enforce_identity before update on public.house_notes
  for each row execute function private.enforce_immutable_columns('id', 'household_id', 'created_by', 'created_at');

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger households_set_updated_at before update on public.households
  for each row execute function public.set_updated_at();
create trigger household_members_set_updated_at before update on public.household_members
  for each row execute function public.set_updated_at();
create trigger chores_set_updated_at before update on public.chores
  for each row execute function public.set_updated_at();
create trigger chore_assignments_set_updated_at before update on public.chore_assignments
  for each row execute function public.set_updated_at();
create trigger task_swaps_set_updated_at before update on public.task_swaps
  for each row execute function public.set_updated_at();
create trigger house_rules_set_updated_at before update on public.house_rules
  for each row execute function public.set_updated_at();
create trigger rule_approvals_set_updated_at before update on public.rule_approvals
  for each row execute function public.set_updated_at();
create trigger shopping_items_set_updated_at before update on public.shopping_items
  for each row execute function public.set_updated_at();
create trigger waste_schedules_set_updated_at before update on public.waste_schedules
  for each row execute function public.set_updated_at();
create trigger house_notes_set_updated_at before update on public.house_notes
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.chores enable row level security;
alter table public.chore_assignments enable row level security;
alter table public.task_swaps enable row level security;
alter table public.house_rules enable row level security;
alter table public.rule_approvals enable row level security;
alter table public.shopping_items enable row level security;
alter table public.waste_schedules enable row level security;
alter table public.house_notes enable row level security;

create policy "profiles_select_household_peers"
on public.profiles for select to authenticated
using (id = auth.uid() or private.shares_household_with(id));

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "households_select_members"
on public.households for select to authenticated
using (private.is_household_member(id));

create policy "households_insert_creator"
on public.households for insert to authenticated
with check (created_by = auth.uid());

create policy "households_update_owner"
on public.households for update to authenticated
using (private.is_household_owner(id))
with check (private.is_household_owner(id));

create policy "households_delete_owner"
on public.households for delete to authenticated
using (private.is_household_member(id) and private.is_household_owner(id));

create policy "household_members_select_members"
on public.household_members for select to authenticated
using (private.is_household_member(household_id));

create policy "household_members_insert_owner"
on public.household_members for insert to authenticated
with check (private.is_household_owner(household_id));

create policy "household_members_update_owner"
on public.household_members for update to authenticated
using (private.is_household_owner(household_id))
with check (private.is_household_owner(household_id));

create policy "household_members_delete_owner"
on public.household_members for delete to authenticated
using (
  private.is_household_member(household_id)
  and private.is_household_owner(household_id)
);

create policy "chores_select_members"
on public.chores for select to authenticated
using (private.is_household_member(household_id));

create policy "chores_insert_creator"
on public.chores for insert to authenticated
with check (private.is_household_member(household_id) and created_by = auth.uid());

create policy "chores_update_creator_or_owner"
on public.chores for update to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
)
with check (private.is_household_member(household_id));

create policy "chores_delete_creator_or_owner"
on public.chores for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

create policy "assignments_select_members"
on public.chore_assignments for select to authenticated
using (private.is_household_member(household_id));

create policy "assignments_insert_creator"
on public.chore_assignments for insert to authenticated
with check (
  created_by = auth.uid()
  and private.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as assignee_membership
    where assignee_membership.household_id = chore_assignments.household_id
      and assignee_membership.user_id = chore_assignments.assignee_id
  )
);

create policy "assignments_update_assignee_creator_owner"
on public.chore_assignments for update to authenticated
using (
  private.is_household_member(household_id)
  and (
    assignee_id = auth.uid()
    or created_by = auth.uid()
    or private.is_household_owner(household_id)
  )
)
with check (
  private.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as assignee_membership
    where assignee_membership.household_id = chore_assignments.household_id
      and assignee_membership.user_id = chore_assignments.assignee_id
  )
  and (
    completed_by is null
    or exists (
      select 1 from public.household_members as completer_membership
      where completer_membership.household_id = chore_assignments.household_id
        and completer_membership.user_id = chore_assignments.completed_by
    )
  )
);

create policy "assignments_delete_creator_owner"
on public.chore_assignments for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

create policy "task_swaps_select_members"
on public.task_swaps for select to authenticated
using (private.is_household_member(household_id));

create policy "task_swaps_insert_requester"
on public.task_swaps for insert to authenticated
with check (
  requested_by = auth.uid()
  and status = 'pending'
  and responded_at is null
  and private.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as recipient_membership
    where recipient_membership.household_id = task_swaps.household_id
      and recipient_membership.user_id = task_swaps.offered_to
  )
);

create policy "task_swaps_cancel_by_requester"
on public.task_swaps for update to authenticated
using (
  private.is_household_member(household_id)
  and requested_by = auth.uid()
  and status = 'pending'
)
with check (
  private.is_household_member(household_id)
  and requested_by = auth.uid()
  and status = 'cancelled'
);

create policy "task_swaps_respond_by_recipient"
on public.task_swaps for update to authenticated
using (
  private.is_household_member(household_id)
  and offered_to = auth.uid()
  and status = 'pending'
)
with check (
  private.is_household_member(household_id)
  and offered_to = auth.uid()
  and status in ('accepted', 'rejected')
);

create policy "task_swaps_delete_requester_owner"
on public.task_swaps for delete to authenticated
using (
  private.is_household_member(household_id)
  and (requested_by = auth.uid() or private.is_household_owner(household_id))
);

create policy "house_rules_select_members"
on public.house_rules for select to authenticated
using (private.is_household_member(household_id));

create policy "house_rules_insert_creator"
on public.house_rules for insert to authenticated
with check (created_by = auth.uid() and private.is_household_member(household_id));

create policy "house_rules_update_creator_owner"
on public.house_rules for update to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
)
with check (private.is_household_member(household_id));

create policy "house_rules_delete_creator_owner"
on public.house_rules for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

create policy "rule_approvals_select_members"
on public.rule_approvals for select to authenticated
using (private.is_household_member(household_id));

create policy "rule_approvals_insert_self"
on public.rule_approvals for insert to authenticated
with check (user_id = auth.uid() and private.is_household_member(household_id));

create policy "rule_approvals_update_self"
on public.rule_approvals for update to authenticated
using (user_id = auth.uid() and private.is_household_member(household_id))
with check (user_id = auth.uid() and private.is_household_member(household_id));

create policy "rule_approvals_delete_self"
on public.rule_approvals for delete to authenticated
using (user_id = auth.uid() and private.is_household_member(household_id));

create policy "shopping_items_select_members"
on public.shopping_items for select to authenticated
using (private.is_household_member(household_id));

create policy "shopping_items_insert_creator"
on public.shopping_items for insert to authenticated
with check (created_by = auth.uid() and private.is_household_member(household_id));

create policy "shopping_items_update_creator_buyer_owner"
on public.shopping_items for update to authenticated
using (
  private.is_household_member(household_id)
  and (
    created_by = auth.uid()
    or purchased_by = auth.uid()
    or status = 'needed'
    or private.is_household_owner(household_id)
  )
)
with check (
  private.is_household_member(household_id)
  and (
    purchased_by is null
    or exists (
      select 1 from public.household_members as purchaser_membership
      where purchaser_membership.household_id = shopping_items.household_id
        and purchaser_membership.user_id = shopping_items.purchased_by
    )
  )
);

create policy "shopping_items_delete_creator_owner"
on public.shopping_items for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

create policy "waste_schedules_select_members"
on public.waste_schedules for select to authenticated
using (private.is_household_member(household_id));

create policy "waste_schedules_insert_owner"
on public.waste_schedules for insert to authenticated
with check (created_by = auth.uid() and private.is_household_owner(household_id));

create policy "waste_schedules_update_owner"
on public.waste_schedules for update to authenticated
using (private.is_household_owner(household_id))
with check (private.is_household_owner(household_id));

create policy "waste_schedules_delete_owner"
on public.waste_schedules for delete to authenticated
using (
  private.is_household_member(household_id)
  and private.is_household_owner(household_id)
);

create policy "house_notes_select_members"
on public.house_notes for select to authenticated
using (private.is_household_member(household_id));

create policy "house_notes_insert_creator"
on public.house_notes for insert to authenticated
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and private.is_household_member(household_id)
);

create policy "house_notes_update_author_editor_owner"
on public.house_notes for update to authenticated
using (
  private.is_household_member(household_id)
  and (
    created_by = auth.uid()
    or updated_by = auth.uid()
    or private.is_household_owner(household_id)
  )
)
with check (
  private.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as editor_membership
    where editor_membership.household_id = house_notes.household_id
      and editor_membership.user_id = house_notes.updated_by
  )
);

create policy "house_notes_delete_creator_owner"
on public.house_notes for delete to authenticated
using (
  private.is_household_member(household_id)
  and (created_by = auth.uid() or private.is_household_owner(household_id))
);

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_household() from public, anon, authenticated;
revoke all on function private.is_household_member(uuid) from public, anon, authenticated;
revoke all on function private.is_household_owner(uuid) from public, anon, authenticated;
revoke all on function private.shares_household_with(uuid) from public, anon, authenticated;
revoke all on function private.enforce_immutable_columns() from public, anon, authenticated;
revoke all on function private.enforce_task_swap_transition() from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;
grant execute on function private.shares_household_with(uuid) to authenticated;

revoke all on table public.profiles, public.households, public.household_members,
  public.chores, public.chore_assignments, public.task_swaps, public.house_rules,
  public.rule_approvals, public.shopping_items, public.waste_schedules,
  public.house_notes from anon;

grant select, insert, update, delete on table public.profiles, public.households,
  public.household_members, public.chores, public.chore_assignments,
  public.task_swaps, public.house_rules, public.rule_approvals,
  public.shopping_items, public.waste_schedules, public.house_notes
  to authenticated;

commit;
