
CREATE OR REPLACE FUNCTION func_users_get_hash(
    in_email VARCHAR(320)
)
RETURNS TABLE (
	user_id uuid,
	username VARCHAR(128),
    salt CHAR(256),
    hash CHAR(128)
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
		u.user_id,
		u.username,
        p.salt,
        p.hash
    FROM
        users u
		LEFT JOIN passwords p on(u.user_id = p.user_id)
    WHERE
        u.email = in_email;
END;
$$ LANGUAGE plpgsql;
