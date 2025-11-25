DROP FUNCTION IF EXISTS func_user_has_project_access;

CREATE OR REPLACE FUNCTION func_user_has_project_access(
    in_user_id uuid,
    in_project_id uuid
)
RETURNS boolean
AS $$
DECLARE
    v_org_id uuid;
    v_is_owner boolean;
    v_is_org_member boolean;
    v_is_project_member boolean;
BEGIN
    -- Get project's organization_id
    SELECT organization_id INTO v_org_id
    FROM projects
    WHERE project_id = in_project_id;
    
    -- Project not found
    IF v_org_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if user is org owner
    SELECT EXISTS(
        SELECT 1 FROM organizations
        WHERE organization_id = v_org_id
        AND owner_user_id = in_user_id
    ) INTO v_is_owner;
    
    IF v_is_owner THEN
        RETURN true; -- Org owner has access to all projects
    END IF;
    
    -- Check if user is org member
    SELECT EXISTS(
        SELECT 1 FROM organizations_members
        WHERE organization_id = v_org_id
        AND user_id = in_user_id
    ) INTO v_is_org_member;
    
    IF NOT v_is_org_member THEN
        RETURN false; -- Not org member, no access
    END IF;
    
    -- Check if user is project member
    SELECT EXISTS(
        SELECT 1 FROM projects_members
        WHERE project_id = in_project_id
        AND user_id = in_user_id
    ) INTO v_is_project_member;
    
    -- User must be both org member AND project member
    RETURN v_is_project_member;
END;
$$ LANGUAGE plpgsql;

