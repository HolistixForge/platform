CREATE OR REPLACE PROCEDURE public.proc_sessions_touch(
    IN in_session_id character varying(50)
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Try to update the existing row
    UPDATE public.sessions
    SET
        last_access = CURRENT_TIMESTAMP
    WHERE session_id = in_session_id;
END;
$BODY$;


ALTER PROCEDURE public.proc_sessions_touch(
	character varying(50)
) OWNER TO postgres;
