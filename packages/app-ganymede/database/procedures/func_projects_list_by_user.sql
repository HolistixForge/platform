CREATE OR REPLACE FUNCTION func_projects_list_by_user(
    in_user_id uuid
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
    SELECT DISTINCT 
        p.project_id,
        p.organization_id,
        p.name,
        p.public,
        p.created_at
    FROM projects p
    INNER JOIN organizations_members om ON p.organization_id = om.organization_id
    WHERE om.user_id = in_user_id
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;