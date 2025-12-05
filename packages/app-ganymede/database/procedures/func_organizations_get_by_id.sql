CREATE OR REPLACE FUNCTION func_organizations_get_by_id(
    in_organization_id uuid
)
RETURNS TABLE (
    organization_id uuid,
    owner_user_id uuid,
    name character varying(100),
    created_at timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.organization_id,
        o.owner_user_id,
        o.name,
        o.created_at
    FROM organizations o
    WHERE o.organization_id = in_organization_id;
END;
$$ LANGUAGE plpgsql;

