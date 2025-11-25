CREATE OR REPLACE FUNCTION func_organizations_list_by_user(
    in_user_id uuid
)
RETURNS TABLE (
    organization_id uuid,
    owner_user_id uuid,
    name character varying(100),
    role character varying(50),
    created_at timestamp without time zone,
    added_at timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.organization_id,
        o.owner_user_id,
        o.name,
        om.role,
        o.created_at,
        om.added_at
    FROM organizations o
    INNER JOIN organizations_members om ON o.organization_id = om.organization_id
    WHERE om.user_id = in_user_id
    ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql;

