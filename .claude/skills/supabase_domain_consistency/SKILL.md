# Supabase Domain Consistency Skill

Use this skill before modifying database schema, adding columns, changing relationships, or adding ownership/scoping logic in the jobbet project.

---

## 1. Purpose

Prevent and repair inconsistent database relationships, scattered ownership logic, weak references, and incorrect source-of-truth choices in the jobbet work-management app.

This skill enforces the canonical model derived from the actual codebase and live database as of its current state (verified against Supabase project `jobbet`, ref `yqtrccftdutraolnfdat`).

---

## 2. When to Use This Skill

Use this skill when:

- Adding a new column that tracks who did something (creator, assignee, owner)
- Adding a new table that represents a task, project, note, or scoped resource
- Adding a new entity that belongs to a `foretag` (company/tenant)
- Questioning whether a relationship needs a foreign key
- Adding a column that appears to reference another table
- Auditing an existing table for domain consistency
- Noticing that app code compensates for a missing database relationship
- Adding a new value to an enum-like `text` column (status, prioritet, roll, typ, modul)

---

## 3. Project Domain Concepts

### Core entities

| Table | Purpose | Notes |
|---|---|---|
| `foretag` | Root tenant entity. All company data belongs to one `foretag`. | Every scoped table has `foretag_id`. |
| `person` | Application-level actor within a `foretag`. | Linked to Supabase Auth via `auth_user_id` (nullable — unlinked/profile rows are possible). `roll`: `admin` \| `medlem` \| `NULL`. `foretag_id` is **nullable** on this table only (see §5). |
| `kund` | Customer, scoped to a `foretag`. | |
| `kontaktperson` | Contact person at a `kund`. | `fornamn`/`efternamn`/`epost` nullable. |
| `projekt` | Project. May belong to a `kund`. | `status` CHECK-constrained: `planerat`, `aktivt`, `pausat`, `avslutat`. Can originate from a `mall_projekt` template via `mall_projekt_id`. |
| `projekt_medlem` | Junction: person ↔ projekt membership. | PK `(projekt_id, person_id)`. `roll`: `agare` \| `redigerare` \| `lasare`. |
| `uppgift` | Task. Core work item. | `status`: `oppen`/`pagar`/`vantar`/`klar`. `prioritet`: `lag`/`medel`/`hog`. Optional `projekt_id`, `person_id` (assignee), `kund_id`, `typ_id`, `serie_id`, `kategori_id`, `anteckningsmall_id`. `ar_placeholder` marks template-derived rows not yet scheduled. Outlook sync fields (`outlook_event_id`, `outlook_ical_uid` — stable fallback key used when Exchange reissues `outlook_event_id` for the same meeting, unique per `(foretag_id, outlook_ical_uid)` when set, `obligatoriska_deltagare`, `valfria_deltagare`). Self-referencing `genererad_fran_uppgift_id`. |
| `uppgiftstyp` | Task type, scoped to `foretag`. | Drives `skapa_uppgifter_vid_klar` (auto-generate follow-up tasks). May carry a default `anteckningsmall_id`. |
| `uppgift_serie` | Recurring task series/template. | `veckodagar` (int2[] restricted to 1-5), `intervall_veckor`, generates `uppgift` rows over time; `senast_genererad_datum` tracks generation cursor. |
| `kategori` | Free-form tag, scoped to `foretag`. | |
| `uppgift_deltagare` | Junction: uppgift ↔ kontaktperson. | PK `(uppgift_id, kontaktperson_id)`. `typ`: `obligatorisk` \| `valfri`. |
| `kund_anteckning` | Customer note. | Markdown `innehall`. |
| `kund_anteckning_deltagare` | Junction: kund_anteckning ↔ kontaktperson. | PK `(kund_anteckning_id, kontaktperson_id)`. |
| `anteckningsmall` | Note template — groups `anteckningsblock`. | |
| `anteckningsblock` | A block within a note template. | Can auto-generate a follow-up `uppgift` (`genererar_uppgift`, `uppgift_titel_mall`, `deadline_dagar_efter_motet`). |
| `uppgift_anteckning` | An actual note instance on an `uppgift`, tied to a `block_id`. | Can itself have generated a follow-up task (`uppgift_id_genererad`). |
| `mall_projekt` | Project template. | |
| `mall_uppgift` | Task template within a `mall_projekt`. | Copied into real `uppgift` rows when a project is created from the template (`dagar_efter_start` offsets the deadline). |
| `dagsfokus` | "Today's focus" pointer to one `uppgift` per person per day. | Person-scoped, not company-wide. |
| `dagsavslut` / `dagsavslut_tanke` | End-of-day check-out and its reflection notes. | Person-scoped. `dagsavslut_tanke.uppgift_id_skapad` links a reflection to a task it spawned. |
| `flexel_installning` / `flexel_post` / `flexel_kvotjustering` | Flex-time tracking: settings, ledger entries, quota adjustments. | `modul`: `flex`/`overtid`/`foraldraledig`(+`ledighet` on `flexel_post`). Person-scoped, admin manages settings. |

**Note on `projekt` / `projekt_medlem`:** root `CLAUDE.md` lumps both tables together as "unused schema." That's only accurate for `projekt_medlem` — confirmed zero references in `src/` via grep. `projekt` itself is a core, actively-developed entity (10+ files reference it, including `src/app/projekt/`), despite having full DB-side support (RLS, CHECK constraint). Treat `projekt` as first-class; treat `projekt_medlem` as genuinely unused per the `CLAUDE.md` rule.

---

## 4. Actor Hierarchy and Multi-Tenant Scoping

```
auth.users                 ← Supabase Auth identity (login only)
    └── person                  ← Application actor, scoped by foretag_id
            └── foretag_id → foretag   ← Tenant root; everything else scopes off this
```

**Rule: every action is attributed to `person.id`, never directly to `auth.users.id`.** The bridge is `person.auth_user_id`.

Three SECURITY DEFINER helper functions back every RLS policy:

```sql
current_foretag_id()  -- select foretag_id from person where auth_user_id = auth.uid()
current_person_id()   -- select id from person where auth_user_id = auth.uid()
is_admin()             -- select roll = 'admin' from person where auth_user_id = auth.uid()
```

Use these — or the equivalent predicate — in every new RLS policy. Do not hand-roll a different lookup.

**Exception to the "foretag_id NOT NULL everywhere" rule:** `person.foretag_id` is nullable. This appears intentional (a person can exist before being assigned to a company during onboarding) — verify current usage before assuming it is a bug.

---

## 5. Enum-Like Columns and CHECK Constraints

These are the CHECK constraints that exist today. **Always verify the current constraint before inserting a new value, and ALTER it first if the value isn't covered** — this mirrors the root `CLAUDE.md` rule and is restated here for schema-change context.

| Table.column | Allowed values |
|---|---|
| `uppgift.status` | `oppen`, `pagar`, `vantar`, `klar` |
| `uppgift.prioritet` | `lag`, `medel`, `hog` |
| `mall_uppgift.status` | `oppen`, `pagar`, `vantar`, `klar` |
| `mall_uppgift.prioritet` | `lag`, `medel`, `hog` |
| `uppgift_serie.prioritet` | `lag`, `medel`, `hog` |
| `person.roll` | `NULL`, `admin`, `medlem` |
| `projekt.status` | `planerat`, `aktivt`, `pausat`, `avslutat` |
| `projekt_medlem.roll` | `agare`, `redigerare`, `lasare` |
| `uppgift_deltagare.typ` | `obligatorisk`, `valfri` |
| `flexel_installning.modul` | `flex`, `overtid`, `foraldraledig` |
| `flexel_post.modul` | `flex`, `overtid`, `foraldraledig`, `ledighet` |

Note the app-level Swedish labels shown in the UI (e.g. `STATUS_LABEL` maps) do not always match the raw DB values 1:1 (ASCII-only in the DB: `oppen`/`pagar`/`hog`/`lag` vs. `öppen`/`pågår`/`hög`/`låg` in `CLAUDE.md`/UI). When editing a CHECK constraint, add the raw ASCII value; the UI label mapping is a separate, app-side concern.

After adding a new allowed value: `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... CHECK (...)`, then run `NOTIFY pgrst, 'reload schema'`.

---

## 6. Relationship Rules

### Foreign key expectations by column pattern

| Column pattern | Expected FK target | Nullable |
|---|---|---|
| `foretag_id` | `foretag(id)` | NOT NULL on every table except `person` |
| `person_id` | `person(id)` | Usually nullable (assignee/owner); NOT NULL on person-scoped logs (`dagsfokus`, `dagsavslut`, `flexel_*`) |
| `kund_id` | `kund(id)` | Nullable |
| `projekt_id` | `projekt(id)` | Nullable on `uppgift`; NOT NULL on `projekt_medlem` |
| `typ_id` | `uppgiftstyp(id)` | Nullable |
| `serie_id` | `uppgift_serie(id)` | Nullable |
| `kategori_id` | `kategori(id)` | Nullable |
| `kontaktperson_id` | `kontaktperson(id)` | NOT NULL on junction tables |
| `anteckningsmall_id` | `anteckningsmall(id)` | Nullable |
| `block_id` | `anteckningsblock(id)` | NOT NULL on `uppgift_anteckning` |
| `mall_projekt_id` | `mall_projekt(id)` | Nullable |

### Junction tables (composite PK, no surrogate key)

- `projekt_medlem (projekt_id, person_id)`
- `uppgift_deltagare (uppgift_id, kontaktperson_id)`
- `kund_anteckning_deltagare (kund_anteckning_id, kontaktperson_id)`

Follow this pattern for new many-to-many relationships rather than introducing a surrogate `id` unless the junction row needs to be referenced from elsewhere.

### Self-references

- `uppgift.genererad_fran_uppgift_id` → `uppgift(id)` — links an auto-generated follow-up task back to its source.
- `dagsavslut_tanke.uppgift_id_skapad` → `uppgift(id)` — links a reflection to the task it spawned.

---

## 7. Recurring & Template Generation Rules

jobbet has two distinct "generate real rows from a template" mechanisms — do not conflate them:

1. **Recurring series**: `uppgift_serie` → `uppgift`. Driven by `veckodagar` + `intervall_veckor`, cursor tracked in `senast_genererad_datum`. New `uppgift` rows copy `person_id`, `kund_id`, `typ_id`, `kategori_id`, `prioritet`, `tidsatgang_timmar`, `klockslag` from the series.
2. **Project templates**: `mall_projekt` → `projekt`, and `mall_uppgift` → `uppgift` (offset by `dagar_efter_start` days from the project's `startdatum`).
3. **Note-driven task generation**: `anteckningsblock.genererar_uppgift` — when true, saving a note in that block can create a follow-up `uppgift` (titled from `uppgift_titel_mall`, deadline offset by `deadline_dagar_efter_motet`). The generated task is linked back via `uppgift_anteckning.uppgift_id_genererad`.

When adding a new template/generation path, follow the existing pattern (explicit copy of scoped columns, not a shared-row/alias approach) and keep `foretag_id` set explicitly on every generated row — never inherit it implicitly through a join.

---

## 8. RLS Rules

1. All policies use the `public` role in `pg_policies` (no `anon`-only exposure observed) and gate on `current_foretag_id()` / `current_person_id()` / `is_admin()`.
2. Company-wide resources (`kund`, `uppgift`, `projekt`, `kategori`, `uppgiftstyp`, notes, templates) use `foretag_id = current_foretag_id()` for SELECT, and the same plus `is_admin()` for mutating admin-only tables (`kund`, `kategori`, `uppgiftstyp`, `person` writes).
3. Person-scoped resources (`dagsfokus`, `dagsavslut`, `dagsavslut_tanke`, `flexel_post`, `flexel_kvotjustering`) use `person_id = current_person_id()` for SELECT/INSERT/DELETE, without a separate `foretag_id` read-gate (though `foretag_id` is still required on INSERT `with_check`).
4. `flexel_installning` SELECT allows either the owning person or an admin in the same company: `person_id = current_person_id() OR (foretag_id = current_foretag_id() AND is_admin())`.
5. `person` SELECT allows either same-company rows or the caller's own row: `foretag_id = current_foretag_id() OR auth_user_id = auth.uid()` — needed because a person's `foretag_id` can be null before onboarding completes.
6. `projekt_medlem` SELECT is nested: visible only if the caller is an admin in that project's company, or already a member of that project.
7. When adding a new table: always enable RLS, and add SELECT/INSERT/UPDATE/DELETE policies scoped by `foretag_id = current_foretag_id()` (or `person_id = current_person_id()` for genuinely personal data), using `is_admin()` for privileged mutations. This matches the `CLAUDE.md` multi-tenant rule.

---

## 9. Foreign Key Rules

1. All `foretag_id` columns (except `person.foretag_id`) must have a FK to `foretag(id)` and be `NOT NULL`.
2. All junction tables must have composite FKs on both sides plus their own `foretag_id` (all three junction tables in this schema carry `foretag_id` directly, not just derived through the parent — preserve this pattern, it keeps RLS predicates simple and index-friendly).
3. Array columns (`uppgift_serie.veckodagar`) cannot have FK constraints — this is expected, not a gap.
4. When a FK is missing and the column stores a UUID from a known table, flag it before making any changes.

---

## 10. Naming Consistency Rules

### Established column naming conventions

| Concept | Canonical name | Type |
|---|---|---|
| Tenant scoping | `foretag_id` | `uuid NOT NULL → foretag` (nullable only on `person`) |
| Actor / assignee | `person_id` | `uuid NULL → person` (NOT NULL on person-scoped logs) |
| Creation time | `created_at` / `skapad_at` | `timestamptz NOT NULL DEFAULT now()` — **both spellings are in active use** (`created_at` is the majority; `uppgift_anteckning`, `anteckningsblock`, `kund_anteckning` use `skapad_at`/`uppdaterad_at`). Match whichever convention the table you're extending already uses — do not silently rename existing columns to unify this.
| Status | `status` | `text` + CHECK constraint |
| Priority | `prioritet` | `text` + CHECK constraint, default `'lag'` |
| Customer FK | `kund_id` | `uuid NULL → kund` |
| Project FK | `projekt_id` | `uuid NULL → projekt` |
| Category FK | `kategori_id` | `uuid NULL → kategori` |
| Task type FK | `typ_id` | `uuid NULL → uppgiftstyp` |

### Rules for new columns

- New actor column → reference `person(id)`, never `auth.users`.
- New tenant-scoped table → `foretag_id uuid NOT NULL REFERENCES foretag(id)`.
- New text enum column → add a CHECK constraint immediately (per root `CLAUDE.md`).
- Match the table's existing `created_at` vs `skapad_at` convention rather than introducing a third naming style.

---

## 11. Pre-Change Checklist

Answer all of these before making any schema change:

**Ownership & scoping**
- [ ] Does this column track an actor? Does it reference `person.id` (not `auth.users.id`)?
- [ ] Does the new table have `foretag_id NOT NULL REFERENCES foretag(id)`?

**Relationships**
- [ ] Does this column store a UUID from another table? Add a FK.
- [ ] Should the FK be nullable or NOT NULL? Match the business rule.
- [ ] What happens when the parent row is deleted? CASCADE, RESTRICT, or SET NULL?

**Enums**
- [ ] Is this an enum-like text column? Does a CHECK constraint already exist (§5)? Extend it, don't skip it.

**Duplication check**
- [ ] Does a column with this semantic already exist under a different name?
- [ ] Is this data derivable from existing columns? Prefer not to store derived data.

**Scope**
- [ ] Is this the smallest change that solves the problem? Prefer additive, targeted changes over broad refactors.
- [ ] Have you explained the risk to the user before applying the change?

**Code search**
- [ ] Grep all references to the column or table being changed before renaming or removing.
- [ ] Check the relevant `types`/interfaces in the Next.js app — columns should be represented there.

**RLS**
- [ ] Does the new table have RLS enabled?
- [ ] Does every policy use `current_foretag_id()`, `current_person_id()`, or `is_admin()` consistently with §8?

---

## 12. Repair Workflow

1. **Identify the symptom** — missing FK, wrong scoping, wrong source of truth, naming inconsistency.
2. **Grep the codebase** — search all reads and writes of the affected column or table. Do not change schema based on DB inspection alone.
3. **Check live data** — count nulls, count mismatches, check for orphaned rows before adding constraints.
4. **Propose the canonical fix** — state which rule from this skill is violated and what the fix should be.
5. **Prefer additive repair** — add a correctly-named column rather than renaming one that code still references.
6. **Migrate data before constraining** — if adding NOT NULL, first verify zero nulls or backfill.
7. **Apply the fix** — use Supabase MCP. Apply the smallest change that fixes the violation.
8. **Verify** — run verification SQL immediately.
9. **Update application code** — update types and queries.
10. **Update documentation** — update `CLAUDE.md` if the change affects a documented rule (e.g. a CHECK constraint's allowed values).
11. **Reload PostgREST** — run `NOTIFY pgrst, 'reload schema'` after every DDL change, per root `CLAUDE.md`.

---

## 13. Verification Workflow

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
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'c' AND conrelid = '<table>'::regclass;

-- Verify RLS policy predicate
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename = '<table>';

-- Verify null count before adding NOT NULL
SELECT COUNT(*) FROM <table> WHERE <column> IS NULL;
```

---

## 14. Output Format

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

## 15. Destructive Changes — Always Warn First

Before performing any of the following, explicitly warn the user and wait for confirmation (this restates the root `CLAUDE.md` Stop Rules for schema work specifically):

- Dropping a table or column
- Deleting data (DELETE without WHERE, or bulk deletes)
- Changing a column type (`ALTER COLUMN ... TYPE`)
- Changing or tightening a CHECK constraint on a populated column
- Changing an RLS policy (scope, role, or predicate) — any multi-tenant scoping change requires approval per root `CLAUDE.md`
- Disabling RLS on any table
- Merging two tables

---

## 16. Things Claude Must Not Do

- Do not use `auth.users.id` as the actor for application actions — always resolve to `person.id` via `auth_user_id`.
- Do not insert or update rows without setting `foretag_id` to the correct tenant (except `person`, where it may legitimately be null pre-onboarding).
- Do not add a new enum value to a CHECK-constrained column without first altering the constraint in a migration.
- Do not rename a column that is still referenced by application code.
- Do not add NOT NULL without first verifying zero nulls in live data.
- Do not drop a column without confirming zero code references via grep.
- Do not silently unify the `created_at`/`skapad_at` naming split — it is existing, load-bearing inconsistency, not a bug to fix opportunistically.
- Do not change any RLS policy predicate without explicit user approval (multi-tenant scoping — root `CLAUDE.md` Stop Rule).
- Do not add logic that depends on `projekt` being unused — it is actively used (see §3 note). `projekt_medlem` genuinely is unused; don't add logic depending on it without explicit instruction, per root `CLAUDE.md`.

---

## 17. Things Claude May Do Directly in Supabase

These are safe to apply directly without user confirmation, consistent with root `CLAUDE.md` (direct Supabase changes are allowed on this project):

- `CREATE INDEX IF NOT EXISTS` — always safe, always concurrent
- Adding a nullable column with an FK (additive, no data risk)
- Adding a CHECK constraint to a new or empty column
- Running `NOTIFY pgrst, 'reload schema'`
- Read-only inventory queries (schema, constraints, RLS policies, row counts)

Always verify after applying, and always save the SQL to `supabase/migrations/` (or the project's equivalent) if the project tracks migrations in-repo.
