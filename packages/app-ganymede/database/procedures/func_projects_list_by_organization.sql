CREATE OR REPLACE FUNCTION func_projects_list_by_organization(
    in_organization_id uuid
)
RETURNS TABLE (
    project_id uuid,
    name character varying(100),
    public boolean,
    created_at timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.project_id,
        p.name,
        p.public,
        p.created_at
    FROM projects p
    WHERE p.organization_id = in_organization_id
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

