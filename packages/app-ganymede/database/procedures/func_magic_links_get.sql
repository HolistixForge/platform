CREATE OR REPLACE FUNCTION func_magic_links_get(
    in_uuid uuid
)
RETURNS TABLE (
	token JSON
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
		ml.token
    FROM
        magic_links ml
    WHERE
        ml.uuid = in_uuid;
END;
$$ LANGUAGE plpgsql;
