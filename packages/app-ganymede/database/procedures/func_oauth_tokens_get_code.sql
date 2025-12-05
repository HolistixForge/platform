CREATE OR REPLACE FUNCTION func_oauth_tokens_get_code(
    in_code VARCHAR(256)
)
RETURNS TABLE (
	-- code
    code VARCHAR(256),
	code_expires_on timestamp without time zone,
	code_redirect_uri VARCHAR(256),
	scope json,
	-- client
	client_id VARCHAR(128),
	client_grants JSON,
	client_redirect_uris JSON,
	client_secret text,
	-- user
	user_id uuid,
	username VARCHAR(128),
	session_id character varying(50)
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
		ot.code, ot.code_expires_on, ot.redirect_uri, ot.scope,
		oc.client_id, oc.grants, oc.redirect_uris, oc.client_secret,
		u.user_id, u.username,
		s.session_id		
    FROM
        oauth_tokens ot
		JOIN oauth_clients oc ON(ot.client_id = oc.client_id)
		JOIN sessions s ON(ot.session_id = s.session_id)
		JOIN users u ON(s.user_id = u.user_id)
    WHERE
        ot.code = in_code;
END;
$$ LANGUAGE plpgsql;

