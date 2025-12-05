DROP PROCEDURE IF EXISTS proc_projects_members_edit;

CREATE OR REPLACE PROCEDURE proc_projects_members_edit(
    in_project_id uuid,
    in_user_id uuid,
    in_add boolean  -- true to add, false to remove
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF in_add THEN
        -- Add user to project members
        INSERT INTO public.projects_members (project_id, user_id)
        VALUES (in_project_id, in_user_id)
        ON CONFLICT (project_id, user_id) DO NOTHING;
    ELSE
        -- Remove user from project members
        DELETE FROM public.projects_members
        WHERE project_id = in_project_id
        AND user_id = in_user_id;
    END IF;
END;
$$;

ALTER PROCEDURE public.proc_projects_members_edit(
    uuid,
    uuid,
    boolean
) OWNER TO postgres;
