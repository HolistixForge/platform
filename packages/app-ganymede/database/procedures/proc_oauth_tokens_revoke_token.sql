CREATE OR REPLACE PROCEDURE public.proc_oauth_tokens_revoke_token(
	IN in_refresh_token text
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN

    DELETE FROM oauth_tokens WHERE refresh_token = in_refresh_token;

END;
$BODY$;

