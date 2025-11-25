DROP PROCEDURE IF EXISTS public.proc_projects_delete;

CREATE OR REPLACE PROCEDURE public.proc_projects_delete(
    IN in_project_id uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    deleted_count INTEGER;
BEGIN

    -- trigger before delete (check if no server running for this server)

    DELETE FROM projects WHERE project_id = in_project_id;

    -- Check if any rows were affected
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Raise an error if no rows were deleted
    IF deleted_count = 0 THEN
        RAISE EXCEPTION 'nothing_done';
    END IF;

END;
$BODY$;


ALTER PROCEDURE public.proc_projects_delete(
    uuid
) OWNER TO postgres;
