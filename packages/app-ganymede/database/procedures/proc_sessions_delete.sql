CREATE OR REPLACE PROCEDURE public.proc_sessions_delete(
    IN in_session_id character varying(50)
)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
BEGIN
   DELETE FROM sessions WHERE session_id = in_session_id;
END;
$BODY$;

ALTER PROCEDURE public.proc_sessions_delete(
	character varying(50)
) OWNER TO postgres;
