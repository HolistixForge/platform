DROP FUNCTION IF EXISTS func_runner_projects_list;

-- Everything the runner needs to mint one token per project, in one query.
--
-- The owner comes from the runners table and is carried into every token: the
-- gateway's reducer records a machine against the authenticated user, and a
-- runner that could name its own owner could enrol itself into a project it
-- was never invited to. Joining here is what keeps that identity out of the
-- runner's hands entirely.
--
-- A revoked runner gets nothing at all rather than an empty list for the wrong
-- reason: the join below drops every row the moment revoked_at is set.
CREATE FUNCTION func_runner_projects_list(
    in_runner_id uuid
)
RETURNS TABLE (
    project_id uuid,
    project_name character varying(100),
    organization_id uuid,
    owner_user_id uuid,
    owner_username character varying(128)
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rp.project_id,
        p.name,
        rp.organization_id,
        r.user_id,
        u.username
    FROM public.runner_projects rp
        JOIN public.runners r ON (r.runner_id = rp.runner_id)
        JOIN public.users u ON (u.user_id = r.user_id)
        JOIN public.projects p ON (p.project_id = rp.project_id)
    WHERE rp.runner_id = in_runner_id
      AND r.revoked_at IS NULL
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;
