DROP PROCEDURE IF EXISTS public.proc_projects_new;

CREATE PROCEDURE public.proc_projects_new(
    IN in_organization_id uuid,
    IN in_project_name character varying(100),
    IN in_public boolean,
    IN in_creator_user_id uuid,
    OUT new_project_id uuid)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    new_project_id := gen_random_uuid();

    -- Insert a new project in the organization
    INSERT INTO projects (project_id, organization_id, name, public, created_at)
    VALUES (new_project_id, in_organization_id, in_project_name, in_public, NOW());

    -- Add creator to projects_members (for project listing)
    IF in_creator_user_id IS NOT NULL THEN
        INSERT INTO projects_members (project_id, user_id, added_at)
        VALUES (new_project_id, in_creator_user_id, NOW())
        ON CONFLICT (project_id, user_id) DO NOTHING;
    END IF;

    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_projects_new(
    uuid,
    character varying(100),
    boolean,
    uuid,
    uuid
) OWNER TO postgres;
