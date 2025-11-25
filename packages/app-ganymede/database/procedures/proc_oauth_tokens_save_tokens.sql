CREATE OR REPLACE PROCEDURE public.proc_oauth_tokens_save_tokens(
    IN in_client_id character varying(128),
	IN in_session_id character varying(50),
	IN in_scope json,
    IN in_access_token text,
	IN in_access_token_expires_on timestamp without time zone,
	IN in_refresh_token text,
	IN in_refresh_token_expires_on timestamp without time zone
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN

    INSERT INTO public.oauth_tokens (
        client_id, session_id, scope, access_token, 
        access_token_expires_on, refresh_token, refresh_token_expires_on
    ) VALUES (
        in_client_id, in_session_id, in_scope, in_access_token,
        in_access_token_expires_on, in_refresh_token, in_refresh_token_expires_on
    );

END;
$BODY$;

