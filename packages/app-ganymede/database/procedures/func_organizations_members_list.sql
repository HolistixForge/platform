CREATE OR REPLACE FUNCTION func_organizations_members_list(
    in_organization_id uuid
)
RETURNS TABLE (
    user_id uuid,
    username character varying(128),
    email character varying(320),
    role character varying(50),
    added_at timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.user_id,
        u.username,
        u.email,
        om.role,
        om.added_at
    FROM organizations_members om
    INNER JOIN users u ON om.user_id = u.user_id
    WHERE om.organization_id = in_organization_id
    ORDER BY om.added_at ASC;
END;
$$ LANGUAGE plpgsql;

