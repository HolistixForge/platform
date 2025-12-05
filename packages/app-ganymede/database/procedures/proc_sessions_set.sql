CREATE OR REPLACE PROCEDURE public.proc_sessions_set(
    IN in_session_id character varying(50),
    IN in_user_id uuid,
    IN in_session json
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Try to update the existing row
    UPDATE public.sessions
    SET
        user_id = in_user_id,
        session = in_session,
        last_access = CURRENT_TIMESTAMP
    WHERE session_id = in_session_id;

    -- If the update didn't affect any rows (session_id doesn't exist), insert a new row
    IF NOT FOUND THEN
        INSERT INTO public.sessions (
            session_id, user_id, session, last_access, created
        )
        VALUES (
            in_session_id, in_user_id, in_session, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
    END IF;
END;
$BODY$;


ALTER PROCEDURE public.proc_sessions_set(
	character varying(50),
    uuid,
    json
) OWNER TO postgres;
