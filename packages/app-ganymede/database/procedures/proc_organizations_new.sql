DROP PROCEDURE IF EXISTS public.proc_organizations_new;

CREATE PROCEDURE public.proc_organizations_new(
    IN in_owner_user_id uuid,
    IN in_name character varying(100),
    OUT new_organization_id uuid)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Create new organization
    INSERT INTO organizations (owner_user_id, name)
    VALUES (in_owner_user_id, in_name)
    RETURNING organization_id INTO new_organization_id;

    -- Add owner as member with owner role
    INSERT INTO organizations_members (organization_id, user_id, role)
    VALUES (new_organization_id, in_owner_user_id, 'owner');

    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_organizations_new(
    uuid,
    character varying(100),
    uuid
) OWNER TO postgres;

