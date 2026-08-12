---
name: ui-migration
description: Use when safely updating existing UI to match documented project standards.
---

# UI Migration Skill

Before editing:
1. Read docs/ui-inventory.md if it exists.
2. Read docs/ui-standards.md if it exists.
3. Identify the existing component or pattern to reuse.
4. If a design system component exists, use it over creating custom implementations.
5. Before larger changes, propose a plan and wait for approval.
6. Avoid broad refactors.
7. Keep behavior unchanged unless requested.

During editing:
1. Change the smallest useful surface.
2. Prefer component reuse over new CSS.
3. Remove duplication only when safe.
4. Keep accessibility intact or improve it.
5. When adding a new card or data-dependent section to a page, always include a skeleton loading state using the `.skeleton` CSS class. Use `const [loading, setLoading] = useState(true)` and render skeleton placeholders that match the shape of the real content (same height/width approximation). Never show empty content or `0` values while data is loading.

After editing:
1. Run lint.
2. Run typecheck.
3. Run relevant tests.
4. Check the feature in a browser — verify the golden path and watch for regressions.
5. Report what changed, what was not changed and remaining risks.
