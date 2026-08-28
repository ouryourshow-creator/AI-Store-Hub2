---
name: Drizzle-kit push/publish gotchas
description: Two non-obvious drizzle-kit (0.31.x) failure modes hit while debugging a Keytopia publish-time migration failure — a DDL-generator bug with cast raw-sql defaults, and a missing config file silently disabling push.
---

## Raw `sql` column default + cast breaks DDL generation

A column default written in the schema as a raw SQL template containing a
function call with a quoted string argument, wrapped in a type cast — e.g.
`.default(sql\`nextval('some_seq')::text\`)` — gets stored by Postgres (and
introspected back) as `(nextval('some_seq'::regclass))::text`. drizzle-kit's
DDL-diff generator (confirmed on drizzle-kit 0.31.10) mis-parses that shape:
it truncates the default expression right after the quoted literal and
appends `NOT NULL` mid-expression, producing invalid SQL like
`... DEFAULT (nextval('some_seq' NOT NULL, ...`. This surfaces at
publish-time schema-diff / migration generation, not at normal runtime
query time — the actual INSERT/SELECT SQL is fine; only DDL generation for
CREATE/ALTER TABLE breaks.

**Why this matters:** any drizzle-kit-generated CREATE TABLE or ALTER TABLE
for a column whose default is a raw `sql` expression with an embedded
quoted argument (sequence name, function arg, etc.) plus an outer cast is at
risk of the same failure — not just sequence-backed order numbers.

**How to apply:** don't give a column with this shape a stored DEFAULT at
all. Move the value generation into application code at insert time instead
(e.g. pass `sql\`nextval('some_seq')::text\`` directly as the column's value
in `.values({...})`, rather than as a schema-level `.default(...)`). This
produces identical runtime behavior and keeps the column out of any DDL
default clause, so the buggy code path never triggers. Prefer this over
trying to reshape the raw-SQL default string to dodge the parser bug.

## Missing `drizzle.config.ts` silently disables `push`

If a package's `push`/`push-force` scripts reference `--config
./drizzle.config.ts` but that file doesn't exist, those scripts fail
immediately — with no schema ever reaching the dev database through the
normal flow. This can go unnoticed for a long time if the app's dev workflow
only runs `build`+`start` (not `dev`, which may chain `push-force` first) and
the dev database already happens to be in sync from an earlier session.

**How to apply:** if a schema-source change needs to reach the dev database
and `push`/`push-force` fails or was never run, check first whether
`drizzle.config.ts` exists next to the package's `package.json` before
assuming the schema itself is wrong. Restoring the config (dialect,
`schema` path, `dbCredentials.url` from `DATABASE_URL`) is a non-destructive
fix and is the correct way to re-enable the normal push flow, rather than
applying schema changes by hand.

## `push`'s diff planner can misjudge an existing unique constraint as new

Even when a named unique constraint already exists in the dev database with
the exact same name, columns, and column order as the schema declares,
`drizzle-kit push`/`push-force` can still decide it needs to *add* that
constraint and stop on the same interactive truncate-table prompt described
below — with no way to confirm non-interactively, since `--force` does not
suppress this particular prompt category.

**Why this matters:** this means `push`/`push-force` can be permanently
blocked for a table that looks correctly migrated, for reasons unrelated to
whatever schema change you're actually trying to apply.

**How to apply:** don't spend time trying to make the general `push`/
`push-force` flow succeed end-to-end across the whole schema if a table
unrelated to your change is hitting this. Apply your own table's change with
scoped, idempotent DDL (e.g. `CREATE TABLE IF NOT EXISTS ...` matching the
Drizzle schema exactly) instead, and leave the pre-existing unrelated drift
for whoever owns that table to investigate.

## `drizzle-kit push` conflates unrelated schema drift

`drizzle-kit push`/`push-force` diffs the *entire* schema against the dev
database in one pass — it will surface and try to apply any other pending
drift (e.g. a newly-unique column) alongside the specific change you're
trying to make, and can hit interactive TTY prompts (e.g. "truncate table?")
that fail outright in a non-interactive shell.

**How to apply:** if you only have permission/intent to apply one specific,
narrow change, and full `push` pulls in unrelated pending drift you haven't
verified is safe, don't force through it. Apply the one approved change
directly (e.g. a scoped `ALTER TABLE ... DROP DEFAULT`) and surface the
other drift separately for the user to decide on.

## New target with Replit-managed session table

When initializing a fresh Neon target, `drizzle-kit push --force` can stop on a
noninteractive prompt because the target already contains `user_sessions`, which
is created by the application but is not declared in the Drizzle schema. A
generated schema migration can create the KeyTopia tables without removing that
session table.

**How to apply:** preserve `user_sessions`; generate and apply a schema migration
that scopes changes to the declared application tables before copying application
data.
