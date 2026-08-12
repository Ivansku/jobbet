# Supabase Domain Consistency Skill

Use this skill before modifying database schema, adding columns, changing relationships, or adding activity/points/ownership logic in the Hemma project.

---

## 1. Purpose

Prevent and repair inconsistent database relationships, scattered ownership logic, weak references, and incorrect source-of-truth choices in the Hemma household app.

This project has evolved organically. Several patterns were added incrementally rather than as a coherent model. This skill enforces the canonical model derived from the actual codebase and database as of its current state.

---

## 2. When to Use This Skill

Use this skill when:

- Adding a new column that tracks who did something (creator, completer, assignee)
- Adding a new table that represents an action, event, or log entry
- Changing how activity is surfaced in the activity feed
- Changing how points are awarded or recorded
- Adding a new entity that can be completed, assigned, or created by a member
- Questioning whether a relationship needs a foreign key
- Adding a column that appears to reference another table
- Auditing an existing table for domain consistency
- Noticing that app code compensates for a missing database relationship

---

## 3. Project Domain Concepts

### Core entities

| Table | Purpose | Notes |
|---|---|---|
| `households` | Root entity. All data belongs to one household. | Every other table has `household_id NOT NULL`. |
| `household_members` | Application-level actor. A person profile within a household. | May or may not have a linked `user_id` (Supabase Auth). `is_profile_only=true` means no login. |
| `tasks` | One-off work items. Completable. | `created_by`, `completed_by`, `assigned_to`, `assigned_members`. |
| `routines` | Recurring task templates with optional sub-steps. | `created_by`, `assigned_to`, `assigned_members`. Completion tracked differently — see §7. |
| `routine_items` | Sub-steps within a routine. Completable. | `completed_by`, `completed_at`. No `created_by` (implicitly the routine editor). |
| `budget_entries` | Budget line items (income, fixed, variable, savings, one-time). Completable. | `created_by`, `completed_by`, `assigned_to`. |
| `budget_transactions` | Actual spend logged against a budget entry. | `member_ids[]` for tagging. No `created_by` FK. |
| `budget_history` | Immutable audit log with JSONB snapshot of entry state. | FK to `budget_entries` is SET NULL on cascade delete; snapshot preserves data. |
| `categories` | User-defined tags scoped to a household. Typed by usage area. | |
| `point_events` | Scoring ledger only. Points awarded per member per action. | NOT an activity log. 5 optional entity FK columns. |
| `member_achievements` | Badges earned by members. | `triggered_by_id/type` is a polymorphic soft reference. |
| `achievements` | Global badge definitions. `key` is the canonical identifier. | |
| `invites` | Household join links. Time-limited, single-use. | `created_by` → household_members. `used_by` → auth.users (soft ref). |
| `push_subscriptions` | Web push tokens. Scoped by `user_id`, not member. | |

### Actor hierarchy

```
auth.users              ← Supabase Auth identity (login only)
    └── household_members   ← Application actor for ALL business logic
            ├── is_profile_only = false  → can log in, can earn achievements
            └── is_profile_only = true   → display-only, no login, no achievements
```

**Rule: All actions are attributed to `household_member.id`. Never attribute an action directly to `auth.users.id`.** The bridge is `household_members.user_id`.

---

## 4. Canonical Source of Truth Rules

### 4.1 Activity source of truth

Activity is tracked on entity rows, not on `point_events`.

| Event | Source table | Timestamp column | Actor column |
|---|---|---|---|
| Task created | `tasks` | `created_at` | `created_by` → household_members |
| Task completed | `tasks` | `completed_at` | `completed_by` → household_members |
| Routine created | `routines` | `created_at` | `created_by` → household_members |
| Routine completed | `point_events` (reason=`routine_completed`) | `created_at` | `member_id` → household_members |
| Routine item completed | `routine_items` | `completed_at` | `completed_by` → household_members |
| Budget entry created | `budget_entries` | `created_at` | `created_by` → household_members |
| Budget entry completed | `budget_entries` | `completed_at` | `completed_by` → household_members |
| Budget transaction logged | `budget_transactions` | `created_at` | `member_ids[0]` (display only) |
| Achievement earned | `member_achievements` | `earned_at` | `member_id` → household_members |

**Exception**: Routine completion uses `point_events(reason='routine_completed')` as the event source because routines recur — `is_completed` is reset per cycle and there is no per-completion actor column on the `routines` row. This is the only event type where `point_events` is the canonical activity source.

**Do not query `point_events` to reconstruct activity for any other event type.**

### 4.2 Points source of truth

`point_events` is the scoring ledger. It records who earned points, how many, why (`reason`), and which entity triggered it. It is not an activity log. Not every activity creates a point event.

### 4.3 Completion source of truth

Completable entities track their own completion state with three columns that always move together:

```sql
is_completed  BOOLEAN NOT NULL DEFAULT false
completed_at  TIMESTAMPTZ NULL        -- NULL = not yet completed
completed_by  UUID NULL REFERENCES household_members(id)
```

Never update `is_completed` without also writing `completed_at` and `completed_by` in the same operation.

### 4.4 Budget history source of truth

`budget_history` is a JSONB snapshot log. The `budget_entry_id` FK may be NULL after the entry is deleted (ON DELETE SET NULL cascade). Use `snapshot->>'id'` to recover the original entry id for deleted entries. This is intentional — do not add NOT NULL to this column.

---

## 5. Ownership and Actor Rules

1. `created_by` always references `household_members.id`, never `auth.users.id`.
2. `completed_by` always references `household_members.id`.
3. `assigned_to` always references `household_members.id` (FK enforced on all tables).
4. `member_id` in `point_events` and `member_achievements` references `household_members.id` (FK enforced).
5. Profile-only members (`is_profile_only = true`) have no `user_id`. They can be assigned tasks but cannot receive achievements. The `memberIsLinked()` guard in `lib/achievements.ts` enforces this.
6. `user_id` columns (`household_members.user_id`, `push_subscriptions.user_id`, `invites.used_by`) reference `auth.users` — Supabase Auth identities, not application actors.
7. Do not add a `user_id` column to any entity table to track who did something. Use `member_id`, `created_by`, or `completed_by` instead.

---

## 6. Relationship Rules

### Foreign key expectations by column pattern

| Column pattern | Expected FK target | Nullable |
|---|---|---|
| `household_id` | `households(id)` | NOT NULL — all entity tables |
| `created_by` | `household_members(id)` | Nullable |
| `completed_by` | `household_members(id)` | Nullable |
| `assigned_to` | `household_members(id)` | Nullable |
| `member_id` | `household_members(id)` | NOT NULL |
| `routine_id` | `routines(id)` | NOT NULL on routine_items |
| `budget_entry_id` | `budget_entries(id)` | NOT NULL on transactions, nullable on history |
| `category_id` | `categories(id)` | Nullable |
| `achievement_key` | `achievements(key)` | NOT NULL on member_achievements |

### Accepted weak references (array columns — no FK possible)

| Column | Table | Type | Notes |
|---|---|---|---|
| `assigned_members` | tasks, routines | `text[]` | UUIDs as text. Historical. Kept in sync with `assigned_to` by app. |
| `member_ids` | budget_transactions | `uuid[]` | Correctly typed. No FK. Tags involved members. |
| `assigned_member_ids` | routine_items | `uuid[]` | Correctly typed. No FK. |

Do not add scalar FK columns to patch individual elements of these arrays. Document the limitation instead.

### Polymorphic reference

`member_achievements.triggered_by_id` + `triggered_by_type` — no FK possible. In-use types: `'task'`, `'routine'`.

---

## 7. Activity Log Rules

1. Do not use `point_events.created_at` as the activity timestamp except for `routine_completed` events.
2. Do not infer the actor from `point_events.member_id` for any event except `routine_completed`.
3. Not every action generates a point event. The activity feed must not be limited to point-generating actions.
4. The activity feed day window is 04:00 local time to 04:00 the next day.
5. When adding a new completable entity: add `completed_at` and `completed_by` to its table. Do not rely on `point_events` for completion attribution.
6. When adding a new creatable entity that needs activity attribution: add `created_by uuid REFERENCES household_members(id)`.
7. When deciding whether a new event type belongs in the feed: check `DashboardActivityFeed.tsx` and add the source query there, not a `point_events` workaround.

---

## 8. Points Rules

1. Points are awarded via `awardPoints()` or `awardSharedPoints()` in `lib/points.ts`. Do not write to `point_events` directly in components.
2. Point values are calculated by `calcPoints(duration, threshold)`. Points are a function of time cost and difficulty only.
3. `reason` is a CHECK-constrained enum. Current values: `task_created`, `task_completed`, `routine_created`, `routine_completed`, `routine_item_created`, `budget_entry_created`, `budget_transaction_created`. Adding a new reason requires updating the CHECK constraint in a migration.
4. Each `point_events` row should reference exactly one source entity (one of the five optional FK columns). No constraint enforces this yet — it is a known gap.
5. When the source entity is deleted, the FK in `point_events` is SET NULL. Point totals are unaffected.
6. Shared tasks/routines split points equally across all active (non-profile-only) household members via `awardSharedPoints()`.
7. Only linked members (`is_profile_only = false`, `user_id IS NOT NULL`) receive achievements.
8. `point_events` completion counts (e.g., `reason='task_completed'`) are used as authoritative completion counters in `lib/achievements.ts`. Do not circumvent this.

---

## 9. RLS Rules

1. All policies use `authenticated` role, not `public`. Anonymous DB access is blocked.
2. All household-scoped tables use `get_my_household_id()` as the filter predicate.
3. `invites` SELECT uses `auth.uid() IS NOT NULL` (no household filter) — intentional, because new users read their invite before joining.
4. `achievements` SELECT uses `USING (true)` — all authenticated users may read global definitions.
5. `push_subscriptions` has both a `service_role` ALL policy (for the edge function) and a user-scoped `authenticated` policy.
6. When adding a new table: always enable RLS and add policies with `authenticated` role and `household_id = get_my_household_id()` unless there is a documented reason not to.

---

## 10. Foreign Key Rules

1. All `household_id` columns must have a FK to `households(id)` — no exceptions.
2. All `*_by` columns must have a FK to `household_members(id)`.
3. All `member_id` columns must have a FK to `household_members(id)`.
4. `category_id` must have a FK to `categories(id)`.
5. Array columns cannot have FK constraints in PostgreSQL. Accept this and document the soft reference.
6. When a FK is missing and the column stores a UUID from a known table, flag it before making any changes.
7. `budget_history.budget_entry_id` is intentionally nullable (ON DELETE SET NULL). Do not change to NOT NULL without also changing the delete cascade and implementing soft-delete.

---

## 11. Naming Consistency Rules

### Established column naming conventions

| Concept | Canonical name | Type |
|---|---|---|
| Household scoping | `household_id` | `uuid NOT NULL` |
| Creation actor | `created_by` | `uuid NULL → household_members` |
| Creation time | `created_at` | `timestamptz NULL DEFAULT now()` |
| Completion actor | `completed_by` | `uuid NULL → household_members` |
| Completion time | `completed_at` | `timestamptz NULL` |
| Completion state | `is_completed` | `boolean NOT NULL DEFAULT false` |
| Primary assignee | `assigned_to` | `uuid NULL → household_members` |
| Multi-person array | `assigned_members` (tasks/routines) | `text[] DEFAULT '{}'` |
| Multi-person array | `assigned_member_ids` (routine_items) | `uuid[] DEFAULT '{}'` |
| Multi-person array | `member_ids` (budget_transactions) | `uuid[] NULL` |
| Points actor | `member_id` | `uuid NOT NULL → household_members` |
| Category FK | `category_id` | `uuid NULL → categories` |
| Legacy category text | `category` | `text NULL` (deprecated, awaiting drop) |

### Rules for new columns

- New `*_by` column → reference `household_members(id)`, never `auth.users`.
- New `assigned_to` column → `uuid NULL REFERENCES household_members(id)`.
- New member array column → use `uuid[]`, not `text[]`.
- Adding completion → add all three: `is_completed`, `completed_at`, `completed_by`.
- New text enum column → add a CHECK constraint immediately.

---

## 12. Pre-Change Checklist

Answer all of these before making any schema change:

**Ownership**
- [ ] Does this column track an actor? Does it use `household_members.id` (not `auth.users.id`)?
- [ ] Is this creation, completion, or assignment? Use the canonical column names.

**Relationships**
- [ ] Does this column store a UUID from another table? Add a FK.
- [ ] Should the FK be nullable or NOT NULL? Match the business rule.
- [ ] What happens when the parent row is deleted? CASCADE, RESTRICT, or SET NULL?

**Duplication check**
- [ ] Does a column with this semantic already exist under a different name?
- [ ] Is this data derivable from existing columns? Prefer not to store derived data.

**Activity and points**
- [ ] Does this action generate activity? Add `created_at`/`created_by` or `completed_at`/`completed_by` on the entity.
- [ ] Does this action award points? Use `awardPoints()`. Need a new `reason` value? Update the CHECK constraint.

**Scope**
- [ ] Is this the smallest change that solves the problem? Prefer additive, targeted changes over broad refactors.
- [ ] Have you explained the risk to the user before applying the change?

**Code search**
- [ ] Grep all references to the column or table being changed before renaming or removing.
- [ ] Check `types/index.ts` — all columns must be represented there.
- [ ] Check `DashboardActivityFeed.tsx` — does this event need to appear in the feed?
- [ ] Check `lib/achievements.ts` and `lib/points.ts` for any usage.

**RLS**
- [ ] Does the new table have RLS enabled?
- [ ] Does every policy use `authenticated` role?
- [ ] Is the predicate `household_id = get_my_household_id()`?

---

## 13. Repair Workflow

1. **Identify the symptom** — missing FK, scattered attribution, wrong source of truth, naming inconsistency.
2. **Grep the codebase** — search all reads and writes of the affected column or table. Do not change schema based on DB inspection alone.
3. **Check live data** — count nulls, count mismatches, check for orphaned rows before adding constraints.
4. **Propose the canonical fix** — state which rule from this skill is violated and what the fix should be.
5. **Prefer additive repair** — add a correctly-named column rather than renaming one that code still references.
6. **Migrate data before constraining** — if adding NOT NULL, first verify zero nulls or backfill.
7. **Apply the fix** — use Supabase MCP. Apply the smallest change that fixes the violation.
8. **Verify** — run verification SQL immediately.
9. **Update application code** — update types, queries, inserts, and the activity feed if affected.
10. **Update documentation** — update relevant docs (schema docs, CLAUDE.md references) when the change affects documented behavior.
11. **Save to repository** — write SQL to `supabase/migrations/` with a date-prefixed filename.
12. **Reload PostgREST** — run `NOTIFY pgrst, 'reload schema'` after every DDL change.

---

## 14. Verification Workflow

Always run verification SQL after applying changes. Include verification queries (commented) in the migration file.

```sql
-- Verify FK exists
SELECT tc.table_name, kcu.column_name, ccu.table_name AS fk_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '<table>';

-- Verify column type and nullability
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>' AND column_name = '<column>';

-- Verify CHECK constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%<table>%';

-- Verify index
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = '<table>';

-- Verify RLS policy role
SELECT policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = '<table>';

-- Verify null count before adding NOT NULL
SELECT COUNT(*) FROM <table> WHERE <column> IS NULL;
```

---

## 15. Output Format

When running an audit or repair, return:

- **Finding** — what is wrong and which rule it violates
- **Evidence** — table, column, row counts, code file and line number
- **Canonical fix** — what the schema should look like per this skill
- **Risk** — what could break (data, constraints, queries)
- **SQL** — exact migration SQL
- **Verification** — SQL to confirm the change
- **Code changes needed** — TypeScript files to update
- **Follow-up** — what cannot be fixed now and why

---

## 16. Destructive Changes — Always Warn First

Before performing any of the following, explicitly warn the user and wait for confirmation:

- Dropping a table
- Dropping a column
- Deleting data (DELETE without WHERE, or bulk deletes)
- Changing a column type (`ALTER COLUMN ... TYPE`)
- Changing or tightening a CHECK constraint on a populated column
- Changing an RLS policy (scope, role, or predicate)
- Disabling RLS on any table
- Merging two tables (moving data from one table into another and dropping the source)

---

## 17. Things Claude Must Not Do

- Do not use `point_events` as an activity log for any event except `routine_completed`.
- Do not use `auth.users.id` (user_id) as the actor for application actions.
- Do not add `created_by` as a substitute for `user_id`. They represent different identities.
- Do not add a scalar FK column to compensate for a missing FK on an array column.
- Do not rename a column that is still referenced by application code.
- Do not add NOT NULL without first verifying zero nulls in live data.
- Do not drop a column without confirming zero code references via grep.
- Do not add a new `reason` value to `point_events` without updating the CHECK constraint in a migration.
- Do not remove the `assigned_to` / `assigned_members` dual-column pattern without updating all code referencing it.
- Do not assume `budget_history.budget_entry_id` being null is a bug.
- Do not write to the `category` (text) legacy columns — they are deprecated and empty.
- Do not change any RLS policy role from `authenticated` to `public`.

---

## 18. Things Claude May Do Directly in Supabase

These are safe to apply directly without user confirmation:

- `CREATE INDEX IF NOT EXISTS` — always safe, always concurrent
- Adding a nullable column with an FK (additive, no data risk)
- Adding a CHECK constraint to a new or empty column
- Tightening an RLS policy (role or predicate)
- Clearing deprecated data (e.g., nulling the `category` text column)
- Dropping a duplicate RLS policy with identical logic to a surviving policy
- Running `NOTIFY pgrst, 'reload schema'`

Always verify after applying and always save SQL to the repository.

---

## 19. Things Claude Should Mark for Later Cleanup

| Issue | Why deferred | Recommended action |
|---|---|---|
| `tasks.assigned_members text[]` and `routines.assigned_members text[]` store UUIDs as text | Requires coordinated code + schema migration across 5+ call sites and the edge function | Change to `uuid[]` in a dedicated PR |
| `tasks.category` and `routines.category` text columns — now empty | Verify empty for a full cycle before DROP | DROP after 30 days of confirmed zero writes |
| `budget_transactions` has no `created_by` FK | `member_ids[]` is used; unclear if first element is always the creator | Clarify semantics, then add `created_by` if needed |
| `budget_history.budget_entry_id` nullable FK — nulled on entry delete | Proper fix is soft-delete (`deleted_at`) on budget_entries | Implement soft-delete before adding NOT NULL here |
| `point_events` 5 FK columns with no mutual exclusivity constraint | A row with two source FKs is meaningless | Add `CHECK` that at most one FK is non-null; long-term migrate to `(entity_type, entity_id)` |
| `routine_items` has no `created_by` | Items are edited in context of their parent routine | Add if item-level creation attribution is needed in the activity feed |
| `categories.created_at` nullable | Should be `NOT NULL DEFAULT now()` | Verify zero nulls, then add constraint |
| `household_members.created_at` nullable | Should be `NOT NULL DEFAULT now()` | Verify zero nulls, then add constraint |
| `routines.is_completed` semantics unclear | Routines recur — when and how is `is_completed` reset? | Document reset logic or add `last_completed_at` to separate cycle state from history |

---

## Appendix A: Point Event Reasons and Source Tables

| reason | source table | FK column used | Actor |
|---|---|---|---|
| `task_created` | tasks | `task_id` | `member_id` = creator |
| `task_completed` | tasks | `task_id` | `member_id` = completer |
| `routine_created` | routines | `routine_id` | `member_id` = creator |
| `routine_completed` | routines | `routine_id` | `member_id` = completer |
| `routine_item_created` | routine_items | `routine_item_id` | `member_id` = creator |
| `budget_entry_created` | budget_entries | `budget_entry_id` | `member_id` = creator |
| `budget_transaction_created` | budget_transactions | `budget_transaction_id` | `member_id` = logger |

---

## Appendix B: Activity Feed Data Sources (Canonical)

```
DashboardActivityFeed.tsx — queries for day window (04:00–04:00):

tasks.created_at           + created_by    → "X skapade [task]"
tasks.completed_at         + completed_by  → "X slutförde [task]"
routine_items.completed_at + completed_by  → "X slutförde [item] i [routine]"
point_events(routine_completed).created_at + member_id → "X slutförde [routine]"
budget_entries.created_at  + created_by    → "X lade till [entry] [amount] kr"
budget_entries.completed_at + completed_by → "X avklarade [entry] [amount] kr"
budget_transactions.created_at + member_ids[0] → "X loggade [tx] [amount] kr under [entry]"
member_achievements.earned_at + member_id  → badge chip
```
