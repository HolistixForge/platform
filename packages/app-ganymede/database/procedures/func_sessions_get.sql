
CREATE OR REPLACE FUNCTION func_sessions_get(
    IN in_session_id character varying(50)
)
RETURNS TABLE (
	session_id character varying(50),
	user_id uuid,
	session JSON,
    created timestamp without time zone,
    last_access timestamp without time zone,
	last_totp timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
		s.session_id,
		s.user_id,
		s.session,
		s.created,
		s.last_access,
		s.last_totp
    FROM
        sessions s
    WHERE
        s.session_id = in_session_id;
END;
$$ LANGUAGE plpgsql;
