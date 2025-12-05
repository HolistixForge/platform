CREATE OR REPLACE FUNCTION func_users_get_local_by_email(
    in_email VARCHAR(320)
)
RETURNS TABLE (
	user_id uuid,
	username VARCHAR(128)
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
		u.user_id,
		u.username
    FROM
        users u
    WHERE
        u.email = in_email AND u.type = 'local';
END;
$$ LANGUAGE plpgsql;
