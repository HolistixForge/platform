CREATE OR REPLACE PROCEDURE public.proc_totp_success(
	IN in_session_id character varying(50),
    IN in_user_id uuid 
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    UPDATE public.totp
    SET
		validated = TRUE
    WHERE user_id = in_user_id;
	
	UPDATE public.sessions
    SET
		last_totp = CURRENT_TIMESTAMP
    WHERE session_id = in_session_id AND user_id = in_user_id;
END;
$BODY$;


ALTER PROCEDURE public.proc_totp_success(
	character varying(50),
    uuid
)
OWNER TO postgres;
