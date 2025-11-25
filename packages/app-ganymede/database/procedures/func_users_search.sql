CREATE OR REPLACE FUNCTION func_users_search(
    in_user_id uuid,
    in_searched character varying(256)
)
RETURNS TABLE (
	user_id uuid,
	username VARCHAR(50),
    firstname VARCHAR(50),
    lastname VARCHAR(50),
    picture VARCHAR(200)
)
AS $$
BEGIN

    IF in_user_id IS NOT NULL THEN

        RETURN QUERY
        SELECT
            u.user_id, u.username, u.firstname, u.lastname, u.picture
        FROM
            users u
        WHERE
            u.user_id = in_user_id;

    ELSE
    
        RETURN QUERY
        SELECT
            u.user_id, u.username, u.firstname, u.lastname, u.picture
        FROM
            users u
        WHERE
            u.username ILIKE '%' || in_searched || '%' OR
            u.firstname ILIKE '%' || in_searched || '%' OR
            u.lastname ILIKE '%' || in_searched || '%';
    END IF;
    
END;
$$ LANGUAGE plpgsql;
