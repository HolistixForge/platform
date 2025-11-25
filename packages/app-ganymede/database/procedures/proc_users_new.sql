CREATE OR REPLACE PROCEDURE public.proc_users_new(
    IN type character varying(50),
	IN provider_id character varying(100),
    IN username character varying(128),
    IN email character varying(320),
    IN picture character varying(512),
    IN firstname character varying(50),
    IN lastname character varying(50),
    IN hash character(128),
    IN salt character(256),
    OUT user_id uuid,
    OUT organization_id uuid)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
BEGIN
    -- Generate a new user_id using gen_random_uuid
    user_id := gen_random_uuid();

    -- Insert into public.users table
    INSERT INTO public.users (
        user_id, type, provider_id, username, email, picture, firstname, lastname
    ) VALUES (
        user_id, type, provider_id, username, email, picture, firstname, lastname
    );

    -- Insert into public.passwords table only if 'type' equals 'local'
    IF type = 'local' THEN
        INSERT INTO public.passwords (user_id, hash, salt)
        VALUES (user_id, hash, salt);
    END IF;

    -- Create default personal organization
    INSERT INTO public.organizations (owner_user_id, name)
    VALUES (user_id, username || '-org')
    RETURNING organizations.organization_id INTO organization_id;

    -- Add user as owner of the organization
    INSERT INTO public.organizations_members (organization_id, user_id, role)
    VALUES (organization_id, user_id, 'owner');

    -- Return the generated user_id and organization_id
    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_users_new(
	character varying(50), 
	character varying(100), 
	character varying(128), 
	character varying(320), 
	character varying(512), 
	character varying(50), 
	character varying(50), 
	character(128), 
	character(256), 
	uuid,
	uuid)
    OWNER TO postgres;
