CREATE OR REPLACE FUNCTION func_users_get_by_provider_id(
    in_provider_id VARCHAR(100)
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
        u.provider_id = in_provider_id;
END;
$$ LANGUAGE plpgsql;
