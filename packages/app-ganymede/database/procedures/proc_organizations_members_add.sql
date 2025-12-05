DROP PROCEDURE IF EXISTS public.proc_organizations_members_add;

CREATE PROCEDURE public.proc_organizations_members_add(
    IN in_organization_id uuid,
    IN in_user_id uuid,
    IN in_role character varying(50))
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Add member to organization
    INSERT INTO organizations_members (organization_id, user_id, role)
    VALUES (in_organization_id, in_user_id, in_role)
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = in_role, added_at = CURRENT_TIMESTAMP;

    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_organizations_members_add(
    uuid,
    uuid,
    character varying(50)
) OWNER TO postgres;

