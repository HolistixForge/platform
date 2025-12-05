CREATE OR REPLACE PROCEDURE public.proc_passwords_flag_reset(
    IN in_user_id uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
BEGIN
   UPDATE public.passwords SET reset = TRUE, hash = '', salt = '' WHERE user_id = in_user_id;
END;
$BODY$;

ALTER PROCEDURE public.proc_passwords_flag_reset(
	uuid
) OWNER TO postgres;
