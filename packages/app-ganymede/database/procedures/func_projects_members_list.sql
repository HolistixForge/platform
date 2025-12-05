DROP FUNCTION IF EXISTS func_projects_members_list;

CREATE OR REPLACE FUNCTION func_projects_members_list(
    in_project_id uuid
)
RETURNS TABLE (
    user_id uuid,
    username character varying(128),
    email character varying(320),
    added_at timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.user_id,
        u.username,
        u.email,
        pm.added_at
    FROM projects_members pm
    INNER JOIN users u ON pm.user_id = u.user_id
    WHERE pm.project_id = in_project_id
    ORDER BY pm.added_at ASC;
END;
$$ LANGUAGE plpgsql;