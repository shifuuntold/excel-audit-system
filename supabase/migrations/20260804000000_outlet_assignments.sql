-- Daily Assignment Board — real outlet assignments, not activity tracking.
-- ---------------------------------------------------------------------
-- One deviation from the requested schema, and why: the field was
-- specified as `outlet_id`, but this system has no normalized outlets
-- table — every audit stores its own outlet as a jsonb snapshot (see the
-- caveat in the auditor/outlet metrics migration). There's nothing an
-- `outlet_id` could reference yet. Using `outlet_name` + `area` text
-- fields instead, matching how outlets are identified everywhere else in
-- this system. If a normalized outlets table gets built later, this is
-- the natural place to add a real outlet_id foreign key alongside these.
-- ---------------------------------------------------------------------

create table if not exists outlet_assignments (
    id uuid primary key default gen_random_uuid(),
    outlet_name text not null,
    area text,
    assigned_to uuid not null references profiles(id) on delete cascade,
    assigned_by uuid not null references profiles(id) on delete set null,
    assigned_date date not null default current_date,
    due_date date,
    priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
    status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Completed', 'Overdue')),
    completion_date date,
    notes text,
    created_at timestamptz not null default now()
);

create index if not exists outlet_assignments_assigned_to_idx on outlet_assignments(assigned_to);
create index if not exists outlet_assignments_status_idx on outlet_assignments(status);

alter table outlet_assignments enable row level security;

-- Auditors: see and update only their own assignments (status, notes,
-- completion_date — marking work done), never someone else's.
drop policy if exists "Auditors view their own assignments" on outlet_assignments;
create policy "Auditors view their own assignments"
    on outlet_assignments for select
    using (assigned_to = auth.uid());

drop policy if exists "Auditors update their own assignments" on outlet_assignments;
create policy "Auditors update their own assignments"
    on outlet_assignments for update
    using (assigned_to = auth.uid())
    with check (assigned_to = auth.uid());

-- Supervisors/Admins: full visibility and control over every assignment.
drop policy if exists "Supervisors manage all assignments" on outlet_assignments;
create policy "Supervisors manage all assignments"
    on outlet_assignments for all
    using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('supervisor', 'admin')
        )
    )
    with check (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('supervisor', 'admin')
        )
    );

-- Assignments left "Pending"/"In Progress" past their due date should read
-- as Overdue without anyone having to remember to update them by hand.
create or replace function mark_overdue_assignments()
returns void
language sql
as $$
  update outlet_assignments
  set status = 'Overdue'
  where status in ('Pending', 'In Progress')
    and due_date is not null
    and due_date < current_date;
$$;

grant execute on function mark_overdue_assignments() to service_role, authenticated;
