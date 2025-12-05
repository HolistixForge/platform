CREATE OR REPLACE FUNCTION func_projects_get_by_org_and_name(
    in_organization_id uuid,
    in_project_name character varying(100)
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
    WHERE p.organization_id = in_organization_id
    AND p.name = in_project_name;
END;
$$ LANGUAGE plpgsql;

