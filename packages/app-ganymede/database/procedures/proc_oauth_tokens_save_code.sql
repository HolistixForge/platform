CREATE OR REPLACE PROCEDURE public.proc_oauth_tokens_save_code(
    IN in_client_id character varying(128),
	IN in_session_id character varying(50),
	IN in_code character varying(256),
	IN in_code_expires_on timestamp without time zone,
	IN in_scope json,
	IN in_redirect_uri character varying(256)
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
 
    INSERT INTO public.oauth_tokens (
        client_id, session_id, code, code_expires_on, scope, redirect_uri
    ) VALUES (
        in_client_id, in_session_id, in_code, in_code_expires_on, in_scope, in_redirect_uri
    );

END;
$BODY$;

