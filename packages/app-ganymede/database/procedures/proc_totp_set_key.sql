CREATE OR REPLACE PROCEDURE public.proc_totp_set_key(
    IN in_user_id uuid,
    IN in_key character(50)
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    UPDATE public.totp
    SET
        key = in_key,
        key_created = CURRENT_TIMESTAMP,
		validated = FALSE
    WHERE user_id = in_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.totp (
            user_id, key, key_created, validated
        )
        VALUES (
            in_user_id, in_key, CURRENT_TIMESTAMP, FALSE
        );
    END IF;
END;
$BODY$;


ALTER PROCEDURE public.proc_totp_set_key(
	uuid,
    character(50)
)
OWNER TO postgres;
