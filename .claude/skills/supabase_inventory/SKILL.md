# Supabase Inventory

Use this skill when auditing the existing Supabase database.

## Goal

Create a clear inventory of the current database and identify inefficiencies, redundancy, missing constraints, missing indexes, unused structures and risky RLS policies.

## Available tools

Use Supabase MCP to inspect the live database.
Use GitHub MCP to inspect application code, migrations, generated types and API usage.

## Rules

You may inspect the live Supabase database.
You may run read only SQL freely.
Do not make changes during inventory.
Do not assume a table, column or policy is unused until checking the application code.
Distinguish between intentional denormalization and accidental redundancy.

## Inventory checklist

1. Tables
   - List all public tables.
   - Identify table purpose.
   - Identify primary keys.
   - Identify foreign keys.
   - Identify nullable columns that look required.
   - Identify duplicated columns across tables.

2. Relationships
   - Map parent and child tables.
   - Find missing foreign keys.
   - Find weak relationships stored only as text or UUID without constraints.

3. Indexes
   - Find unused indexes.
   - Find duplicate indexes.
   - Find missing indexes for foreign keys.
   - Find missing indexes for common filters in application code.

4. RLS
   - List all RLS policies.
   - Identify duplicated policy logic.
   - Identify policies that look too broad.
   - Identify policies that may be expensive.

5. Redundancy
   - Find repeated status fields.
   - Find repeated ownership fields.
   - Find duplicated user profile fields.
   - Find derived values that may not need to be stored.
   - Find JSONB columns that should maybe be normalized.

6. Code usage
   - Search the GitHub repo for every suspicious table and column before suggesting removal.
   - Check frontend queries, backend functions, edge functions and generated Supabase types.

## Output format

Return:

- Executive summary
- Database map
- Findings grouped by severity
- Evidence for each finding
- Recommended action
- Whether Claude may safely fix it directly
- Whether user confirmation is recommended
