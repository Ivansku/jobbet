# Skill usage rules

These skills are mandatory — not optional — at the listed trigger points. Do not skip them because the change "looks small".

## UI skills

- **`/ui-audit`** — run before any UI change that touches an existing component, layout, or visual pattern. Do not do ad-hoc inline analysis instead.
- **`/ui-migration`** — run when updating existing UI to match project standards. Read `docs/ui-inventory.md` and `docs/ui-standards.md` first if they exist.

## Database skills

- **`/supabase_domain_consistency`** — run before adding any table, column, relationship, or ownership/points logic. No exception. This skill defines canonical column names, actor rules, FK expectations, and multi-tenant scoping rules.
- **`/supabase_prevention`** — run before proposing any schema change to check for redundancy, missing constraints, or inefficient design.
- **`/supabase_inventory`** — run when auditing the existing schema or before a larger refactor.

If a skill was not run and a gap is found later (missing `foretag_id`, wrong FK, missing RLS policy), acknowledge it and fix it before continuing.

# Stop rules

Claude must ask for approval before:
1. Replacing a shared component.
2. Changing global styles.
3. Changing design tokens.
4. Refactoring more than one feature area.
5. Introducing a new UI library.
6. Changing routing, state management, or server action behavior as part of UI work.
7. Any change that touches multi-tenant scoping logic (`foretag_id`, RLS policies).

# Debugging rules

When a bug is hard to reproduce or the root cause is unclear:

1. **Verify the entry point first.** Before changing any logic, grep for the button text or server action name to confirm *which file and component* actually handles the action. Never assume — always confirm.

2. **Add logging before theorising.** If the cause is unclear after reading the code, add `console.info/warn/error` at the very start of the suspect function (before any early returns) so the user can confirm in browser devtools that the right code path is executing. Do this *early* — not after several failed fix attempts.

3. **Confirm the path with the user.** When a UI flow is described (e.g. "Kanban → drag uppgift → kolumn X"), ask or grep to verify the exact component before editing. If there is more than one plausible match, list them and confirm which one the user reaches.

# Workflow rules

- After completing work, always commit AND push to remote (`git push`). Do not stop at commit only.
- Vercel deploys automatically from `main`. Never push directly to `main` if a change is not ready to deploy.
- Commit between features/logical units of work rather than batching everything into one commit at the end of a session, so the git log stays readable and bisectable.

# Database rules

This project uses Supabase with Row Level Security. Claude may use Supabase MCP and GitHub MCP. Direct Supabase changes are allowed, but Claude must still act carefully given the multi-tenant data model.

## Multi-tenant scoping

- Every table that holds user data **must** have a `foretag_id` column with an RLS policy that scopes reads and writes to the authenticated user's company.
- Never insert or update rows without setting `foretag_id` to the correct tenant.
- When adding a new table, verify that RLS is enabled and that policies cover SELECT, INSERT, UPDATE, and DELETE before considering the table production-ready.

## Column constraints

- `uppgift.status` has a CHECK constraint: allowed values are `öppen`, `pågår`, `klar`. Verify before inserting new values or ALTER the constraint first.
- `uppgift.prioritet` has a CHECK constraint: allowed values are `låg`, `medel`, `hög`.
- `person.roll` has a CHECK constraint: allowed values are `admin`, `medlem`.
- Before inserting a new value into any enum-like column, check if a CHECK constraint exists and verify the value is allowed — or ALTER the constraint first.
- After adding columns or changing constraints, run `NOTIFY pgrst, 'reload schema'` to refresh PostgREST cache.

## Unused schema

- The `projekt` and `projekt_medlem` tables exist in the schema but are **not used** in the app. Do not add logic that references them without explicit instruction — they may be removed or redesigned later.

# Token Efficiency

## Subagents

Do not use subagents by default. Only use them when:
- the user explicitly asks for it, or
- the task requires broad investigation across many independent parts of the codebase, a security review, or multiple parallel debugging tracks that can't reasonably be done sequentially.

For normal implementation work, bug fixes, copy changes, UI tweaks, and minor refactors: work directly in the main context.

If you believe subagents are needed, justify it in one sentence and wait for approval before spawning one.

## Session length

Keep sessions short and scoped to one task. Start a new session per task/feature rather than continuing in the same long session across multiple unrelated tasks.

If a session runs long or switches to an unrelated task, suggest the user restart (`/clear` or a new session) instead of letting context keep accumulating.

## Context size

Keep context under control:
- Don't read entire files or logs when only part is needed. Grep/search first to find the relevant lines, then read only that section.
- Avoid dumping full database schemas, migration history, or large API responses into context when only a subset is relevant to the task.
- Discard or summarize intermediate results once no longer needed, instead of leaving them in context.

## Skills and MCP calls

Don't run audit-style skills proactively or repeatedly within the same session unless the user asks or code changes actually warrant a new run.

Batch independent tool calls (e.g. multiple Supabase or Vercel MCP calls) into the same turn instead of making them sequentially across separate turns, when they don't depend on each other.

## Cache awareness

Don't change CLAUDE.md mid-session unnecessarily — it invalidates cached context. Stable context at the start of a session keeps cache hit rate high.