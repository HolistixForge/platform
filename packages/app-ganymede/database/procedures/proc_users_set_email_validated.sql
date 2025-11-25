CREATE OR REPLACE PROCEDURE public.proc_users_set_email_validated(
    IN in_user_id uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    
	UPDATE public.users
    SET
        email_validated = TRUE
    WHERE user_id = in_user_id;

END;
$BODY$;


ALTER PROCEDURE public.proc_users_set_email_validated(
	uuid
) OWNER TO postgres;
