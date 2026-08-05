DROP FUNCTION IF EXISTS func_runner_projects_add;

-- Opt a machine into a project.
--
-- A function and not a procedure because the caller must be told whether it
-- was allowed, and the rule is enforced in the WHERE clause rather than in a
-- preceding SELECT: only the machine's own owner may make the first placement
-- on it. Checking separately would leave a window where the runner changes
-- hands between the two statements, and would answer "no such runner" and
-- "not your runner" differently — which tells a caller whose machines exist.
--
-- The gateway is the caller, authenticated with its organization token, and it
-- passes the user who made the placement. That user is checked here, against
-- the runners table, rather than taken on trust from collab state.
--
-- Idempotent: a placement is made every time someone starts a service, and
-- only the first one is an event. Returns the row either way, so the caller
-- does not have to distinguish.
--
-- The returned columns are prefixed because plpgsql cannot tell an OUT
-- parameter named `runner_id` from the column of the same name in the
-- ON CONFLICT target list, and refuses the whole statement as ambiguous.
CREATE FUNCTION func_runner_projects_add(
    in_runner_id uuid,
    in_project_id uuid,
    in_organization_id uuid,
    in_user_id uuid
)
RETURNS TABLE (
    granted_runner_id uuid,
    granted_project_id uuid
)
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.runner_projects AS rp (
        runner_id, project_id, organization_id, added_by
    )
    SELECT r.runner_id, in_project_id, in_organization_id, in_user_id
    FROM public.runners r
    WHERE r.runner_id = in_runner_id
      AND r.user_id = in_user_id
      AND r.revoked_at IS NULL
    -- A no-op update rather than DO NOTHING: DO NOTHING returns no row on a
    -- repeat, which the caller would read as a refusal.
    ON CONFLICT ON CONSTRAINT runner_projects_pkey DO UPDATE
        SET organization_id = EXCLUDED.organization_id
    RETURNING rp.runner_id, rp.project_id;
END;
$$ LANGUAGE plpgsql;
