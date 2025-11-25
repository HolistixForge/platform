CREATE OR REPLACE PROCEDURE public.proc_magic_links_set(
    IN in_uuid uuid,
    IN in_token JSON,
    IN in_expire timestamp without time zone
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    
	INSERT INTO public.magic_links (
		uuid, token, expire
	)
	VALUES (
		in_uuid, in_token, in_expire
	);

END;
$BODY$;


ALTER PROCEDURE public.proc_magic_links_set(
	uuid,
    JSON,
    timestamp without time zone
) OWNER TO postgres;
