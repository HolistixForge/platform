DROP PROCEDURE IF EXISTS public.proc_organizations_members_update_role;

CREATE PROCEDURE public.proc_organizations_members_update_role(
    IN in_organization_id uuid,
    IN in_user_id uuid,
    IN in_role character varying(50))
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Update member role
    UPDATE organizations_members
    SET role = in_role
    WHERE organization_id = in_organization_id
    AND user_id = in_user_id;

    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_organizations_members_update_role(
    uuid,
    uuid,
    character varying(50)
) OWNER TO postgres;

