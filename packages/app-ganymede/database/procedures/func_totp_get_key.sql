
CREATE OR REPLACE FUNCTION func_totp_get_key(
    in_user_id uuid
)
RETURNS TABLE (
    key CHAR(50),
	validated BOOLEAN
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
		t.key,
		t.validated
    FROM
        totp t
    WHERE
        t.user_id = in_user_id;
END;
$$ LANGUAGE plpgsql;
