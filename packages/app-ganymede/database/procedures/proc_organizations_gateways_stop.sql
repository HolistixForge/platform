DROP PROCEDURE IF EXISTS public.proc_organizations_gateways_stop;

CREATE OR REPLACE PROCEDURE public.proc_organizations_gateways_stop(
    IN in_gateway_id uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Mark all active gateway assignments as ended
    UPDATE public.organizations_gateways 
    SET ended_at = CURRENT_TIMESTAMP 
    WHERE gateway_id = in_gateway_id
    AND ended_at IS NULL;

    -- Mark gateway as ready
    UPDATE public.gateways
    SET ready = TRUE
    WHERE gateway_id = in_gateway_id;

    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_organizations_gateways_stop(
    uuid
) OWNER TO postgres;

