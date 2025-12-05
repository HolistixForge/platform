CREATE OR REPLACE PROCEDURE public.proc_oauth_tokens_revoke_code(
	IN in_code character varying(256)
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN

    DELETE FROM oauth_tokens WHERE code = in_code;

END;
$BODY$;

