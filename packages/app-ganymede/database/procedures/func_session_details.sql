
CREATE OR REPLACE FUNCTION func_sessions_details(
    IN in_session_id character varying(50)
)
RETURNS TABLE (
	session_id character varying(50),
    session_created timestamp without time zone,
    session_last_access timestamp without time zone,
	session_data JSON,
	
	user_id uuid,
	user_type character varying(50),
	username character varying(128),
	firstname character varying(50),
	lastname character varying(50),
	email character varying(320),
	email_validated boolean,
	signup_date timestamp without time zone,
	picture character varying(512),
	
	totp_enabled boolean,
	totp_last timestamp without time zone,
	
	password_reset boolean
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
		s.session_id,
		s.created as session_created,
		s.last_access as session_last_access,
		s.session as session_data,
		
		u.user_id,
		u.type as user_type,
		u.username,
		u.firstname,
		u.lastname,
		u.email,
		u.email_validated,
		u.signup_date,
		u.picture,
		
		CASE WHEN t.validated IS NOT NULL AND t.validated = TRUE THEN TRUE ELSE FALSE END AS totp_enabled,
		s.last_totp as totp_last,
		
		p.reset as password_reset
    FROM
        sessions s
		LEFT JOIN users u on(s.user_id = u.user_id)
		LEFT JOIN totp t on(u.user_id = t.user_id)
		LEFT JOIN passwords p on(u.user_id = p.user_id)
    WHERE
        s.session_id = in_session_id;
END;
$$ LANGUAGE plpgsql;
