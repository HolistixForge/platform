DROP PROCEDURE IF EXISTS public.proc_runners_enrol;

-- The owner is a parameter and not something the caller may state about itself:
-- the route takes it from the authenticated token.
CREATE PROCEDURE public.proc_runners_enrol(
    IN in_user_id uuid,
    IN in_label character varying(128),
    OUT new_runner_id uuid)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    new_runner_id := gen_random_uuid();

    INSERT INTO public.runners (runner_id, user_id, label)
    VALUES (new_runner_id, in_user_id, in_label);

    RETURN;
END;
$BODY$;
