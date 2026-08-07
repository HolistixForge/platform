-- Migration: a project's collaborative state, in the database
-- Purpose: give an existing installation the table the save and restore routes
-- were already changed to depend on.
--
-- `schema/02-schema.sql` runs only when a database is created — `01-reset.sql`
-- drops and recreates it. Everything that has to reach a database that already
-- exists lives here, and `database/run.sh` applies this directory in sorted
-- order. The table was added to the schema file and to nothing else, so on any
-- installation that was not rebuilt from scratch:
--
--   push  →  INSERT INTO organization_state …   relation does not exist,
--            caught, answered 500 "Failed to store data" — every autosave and
--            every shutdown save silently lost.
--   pull  →  SELECT … FROM organization_state   throws before
--            `migrateOrgDataFile` is reached, so the file fallback never runs
--            either and the restore answers 500.
--
-- Which is the data loss the change was written to prevent, reintroduced by
-- the upgrade. Measured on this workspace: Ganymede logged
-- `relation "organization_state" does not exist` every five minutes for five
-- hours while the project it was trying to save had nothing keeping it.
--
-- Kept character for character in step with `schema/02-schema.sql`. Two
-- definitions of one table is a thing that drifts, and the drift is only
-- visible on a fresh install versus an upgraded one — which is to say, in
-- production and not in development.

CREATE TABLE IF NOT EXISTS public.organization_state
(
    organization_id uuid NOT NULL,
    -- Which gateway last wrote. Recorded rather than enforced: a second
    -- gateway writing is a thing to notice, not to refuse, and refusing would
    -- lose the state it was trying to save.
    gateway_id uuid,
    data jsonb NOT NULL,
    -- The gateway's own timestamp, kept apart from ours: the two disagree when
    -- a save is slow, and which one is meant matters when reading them back.
    saved_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT organization_state_pkey PRIMARY KEY (organization_id),
    CONSTRAINT fk_organization_state_organization_id FOREIGN KEY (organization_id)
        REFERENCES public.organizations (organization_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organization_state_updated_at
    ON public.organization_state(updated_at);

-- The privileges, taken from a table the application already uses.
--
-- Migrations run as the superuser; the application connects as a limited role
-- whose name is per environment (`ganymede_app_<env>`), so this file cannot
-- name it. The environment scripts do run
-- `ALTER DEFAULT PRIVILEGES … GRANT … ON TABLES`, which would cover a table
-- created afterwards — but only in a database where that was run, by the same
-- role, and an installation provisioned some other way has no such promise.
-- The failure mode is the quiet one: the table exists, the migration reported
-- success, and every write is refused for lack of a grant. Measured here, by
-- hand, on exactly this table.
--
-- So the grant is derived instead of assumed: whoever may already INSERT into
-- `organizations` is the application, and gets the same on this table. Nothing
-- is granted that was not already granted somewhere.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT DISTINCT grantee
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = 'organizations'
          AND privilege_type = 'INSERT'
          AND grantee NOT IN ('PUBLIC', current_user)
    LOOP
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_state TO %I',
            r.grantee
        );
    END LOOP;
END $$;
