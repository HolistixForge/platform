DROP PROCEDURE IF EXISTS public.proc_organizations_delete;

CREATE PROCEDURE public.proc_organizations_delete(
    IN in_organization_id uuid)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Delete organization (cascade will handle members, projects, etc.)
    DELETE FROM organizations
    WHERE organization_id = in_organization_id;

    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_organizations_delete(
    uuid
) OWNER TO postgres;

