# Supabase Remediation

Use this skill when applying database improvements directly to Supabase.

## Goal

Safely improve the live Supabase database while keeping the GitHub repo aligned.

## Permissions

This is a hobby project.
Direct Supabase changes are allowed.

## Hard rules

Before changing anything, state:
- What will change
- Why it should change
- Risk level
- Rollback approach

After changing anything:
- Verify the change in Supabase
- Add or update a matching SQL file in the GitHub repo
- Update database documentation if relevant
- Update generated types if the project uses them

## Safe direct changes

These can usually be done directly:

- Add missing indexes
- Add non destructive comments
- Add views
- Add helper functions
- Add non breaking constraints when existing data is valid
- Rename documentation files
- Add database documentation
- Add tests or validation queries

## Changes that need extra caution

These may still be allowed, but require an explicit warning before execution:

- Drop columns
- Drop tables
- Drop indexes that may affect performance
- Rename columns
- Change column types
- Merge tables
- Backfill data
- Modify RLS policies
- Disable RLS
- Delete duplicate data
- Change auth related tables, triggers or policies

## Required workflow

1. Read the relevant inventory finding.
2. Check GitHub code usage.
3. Run verification SQL.
4. Apply the smallest useful change.
5. Verify the result.
6. Save the SQL in the repo.
7. Summarize what changed.

## Output format

For every action, return:

- Action taken
- SQL executed
- Verification result
- Files updated
- Remaining risk
- Suggested next step
