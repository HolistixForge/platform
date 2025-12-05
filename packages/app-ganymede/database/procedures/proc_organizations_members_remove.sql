DROP PROCEDURE IF EXISTS public.proc_organizations_members_remove;

CREATE PROCEDURE public.proc_organizations_members_remove(
    IN in_organization_id uuid,
    IN in_user_id uuid)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Remove member from organization
    DELETE FROM organizations_members
    WHERE organization_id = in_organization_id
    AND user_id = in_user_id;

    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_organizations_members_remove(
    uuid,
    uuid
) OWNER TO postgres;

