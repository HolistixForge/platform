-- Migration: which projects a machine has been opted into
-- Purpose: give the runner a token per project rather than one token that
-- speaks for every project at once.
--
-- Enrolment is per machine; consent is per project. A runner executes what the
-- platform sends it, and what it will be sent is a playbook — Ansible has
-- `shell`, `command`, `raw`. Opting a laptop into a project means agreeing to
-- run that project's workloads on it, and a single token covering everything
-- would make that grant impossible to give one project at a time or to take
-- back from one project alone.
--
-- Why this lives in Ganymede and not in the gateway's collab state, where the
-- machine catalog lives: a gateway holds one project's room and cannot see
-- what another project already granted, and the runner has to be able to ask
-- "which projects am I in" before it has connected to any gateway at all. The
-- catalog stays where it is — it is what the project's members look at — and
-- this is the record the token is minted from.
--
-- The row is written by the gateway when a placement is made, and the check
-- that it is the machine's *owner* making it happens here, against the runners
-- table, rather than being taken on trust from collab state.

CREATE TABLE IF NOT EXISTS public.runner_projects
(
    runner_id uuid NOT NULL,
    project_id uuid NOT NULL,
    -- Carried rather than derived from the project on read: the token names it,
    -- and a join for a value that cannot change is a join done on every
    -- heartbeat.
    organization_id uuid NOT NULL,
    -- Who opted the machine in. Only its owner can, which is checked when the
    -- row is written; kept afterwards because "who let this project onto my
    -- laptop" is a question its owner is entitled to an answer to.
    added_by uuid,
    added_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (runner_id, project_id),
    CONSTRAINT fk_runner_projects_runners FOREIGN KEY (runner_id)
        REFERENCES public.runners (runner_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_runner_projects_projects FOREIGN KEY (project_id)
        REFERENCES public.projects (project_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_runner_projects_organizations FOREIGN KEY (organization_id)
        REFERENCES public.organizations (organization_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_runner_projects_users FOREIGN KEY (added_by)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL
);

-- Deleting a project takes its grants with it, so a machine is not left
-- holding a claim on something that no longer exists.
CREATE INDEX IF NOT EXISTS idx_runner_projects_project
    ON public.runner_projects(project_id);
