-- Migration: Bind a project to a GitHub organization
-- Purpose: Constrain which container images a project may run.
--
-- Tenant images are pulled from ghcr.io with a github_token shared at project
-- scope. Without a binding, project A could register ghcr.io/orgB/private and,
-- if its token happened to have access, the platform would fetch it on A's
-- behalf — the platform as confused deputy.
--
-- With the binding, the allowlist becomes structural: a reference is legal only
-- when it sits under ghcr.io/<github_organization>/. That is a string check, so
-- it holds before any network call and cannot be bypassed by a registry that
-- answers differently than expected.
--
-- NULL means "no GitHub organization linked", which is the correct state for
-- every project that only runs built-in images. Those never consult this
-- column: they are ours, and carry no tenant credential.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects'
        AND column_name = 'github_organization'
    ) THEN
        ALTER TABLE public.projects
        ADD COLUMN github_organization character varying(39);

        RAISE NOTICE 'Column github_organization added to projects table';
    ELSE
        RAISE NOTICE 'Column github_organization already exists';
    END IF;
END $$;

-- GitHub logins are 1-39 characters, alphanumeric with single inner hyphens.
-- GHCR lowercases the owner in image paths, so store it lowercase and compare
-- lowercase — otherwise "Acme" and "acme" would be two different allowlists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'projects'
        AND constraint_name = 'projects_github_organization_format'
    ) THEN
        ALTER TABLE public.projects
        ADD CONSTRAINT projects_github_organization_format
        CHECK (
            github_organization IS NULL
            OR github_organization ~ '^[a-z0-9]([a-z0-9]|-(?=[a-z0-9])){0,38}$'
        );

        RAISE NOTICE 'Constraint projects_github_organization_format added';
    ELSE
        RAISE NOTICE 'Constraint projects_github_organization_format already exists';
    END IF;
END $$;
