DROP PROCEDURE IF EXISTS public.proc_gateways_set_ready;


CREATE OR REPLACE PROCEDURE public.proc_gateways_set_ready(
    IN in_gateway_id uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN

    UPDATE public.gateways SET ready = TRUE WHERE gateway_id = in_gateway_id;

    RETURN;
END;
$BODY$;


ALTER PROCEDURE public.proc_gateways_set_ready(
	uuid
) OWNER TO postgres;
