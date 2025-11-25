DROP FUNCTION IF EXISTS func_user_get_org_role;

CREATE OR REPLACE FUNCTION func_user_get_org_role(
    in_user_id uuid,
    in_organization_id uuid
)
RETURNS character varying(50)
AS $$
DECLARE
    v_role character varying(50);
BEGIN
    -- First check if user is the org owner
    SELECT 'owner' INTO v_role
    FROM organizations
    WHERE organization_id = in_organization_id
    AND owner_user_id = in_user_id;
    
    -- If owner found, return 'owner'
    IF v_role IS NOT NULL THEN
        RETURN v_role;
    END IF;
    
    -- Else check if user is a member and get their role
    SELECT role INTO v_role
    FROM organizations_members
    WHERE organization_id = in_organization_id
    AND user_id = in_user_id;
    
    -- Return role (could be 'admin', 'member', etc.) or NULL if not a member
    RETURN v_role;
END;
$$ LANGUAGE plpgsql;

