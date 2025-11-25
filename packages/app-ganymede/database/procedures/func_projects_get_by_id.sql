DROP FUNCTION IF EXISTS func_projects_get_by_id;

CREATE FUNCTION func_projects_get_by_id(
    in_project_id uuid
)
RETURNS TABLE (
    project_id uuid,
    organization_id uuid,
    name character varying(100),
    public boolean,
    created_at timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.project_id,
        p.organization_id,
        p.name,
        p.public,
        p.created_at
    FROM projects p
    WHERE p.project_id = in_project_id;
END;
$$ LANGUAGE plpgsql;