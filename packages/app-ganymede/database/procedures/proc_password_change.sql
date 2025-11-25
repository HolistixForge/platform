CREATE OR REPLACE PROCEDURE public.proc_password_change(
    IN in_user_id uuid,
    IN in_hash character(128),
    IN in_salt character(256)
)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
BEGIN
    UPDATE public.passwords SET
		reset = FALSE,
		hash = in_hash,
		salt= in_salt
	WHERE user_id = in_user_id;
END;
$BODY$;

ALTER PROCEDURE public.proc_password_change(
	uuid, 
	character(128), 
	character(256)
) OWNER TO postgres;
