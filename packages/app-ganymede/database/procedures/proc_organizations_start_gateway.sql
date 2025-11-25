DROP PROCEDURE IF EXISTS public.proc_organizations_start_gateway;

CREATE OR REPLACE PROCEDURE public.proc_organizations_start_gateway(
    IN in_organization_id uuid,
    OUT gateway_id uuid,
    OUT container_name character varying(100),
    OUT http_port integer,
    OUT vpn_port integer,
    OUT tmp_handshake_token uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    tmp_handshake_token := gen_random_uuid();

    LOCK TABLE organizations_gateways IN ROW EXCLUSIVE MODE;

    -- Find an available gateway from pool
    SELECT g.gateway_id, g.container_name, g.http_port, g.vpn_port
    INTO gateway_id, container_name, http_port, vpn_port
    FROM public.gateways g
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.organizations_gateways og
        WHERE g.gateway_id = og.gateway_id
        AND og.ended_at IS NULL
    )
    AND g.ready = TRUE
    LIMIT 1
    FOR UPDATE;

    -- Check if a gateway is available
    IF gateway_id IS NULL THEN
        RAISE EXCEPTION 'no_gateway_available';
    END IF;

    -- Insert the association between organization and gateway
    INSERT INTO public.organizations_gateways (organization_id, gateway_id, tmp_handshake_token, started_at)
    VALUES (in_organization_id, gateway_id, tmp_handshake_token, CURRENT_TIMESTAMP);

    -- Mark gateway as not ready (allocated)
    UPDATE public.gateways SET ready = FALSE WHERE gateways.gateway_id = proc_organizations_start_gateway.gateway_id;

    COMMIT;

    RETURN;
END;
$BODY$;

ALTER PROCEDURE public.proc_organizations_start_gateway(
    uuid,
    OUT uuid,
    OUT character varying(100),
    OUT integer,
    OUT integer,
    OUT uuid
) OWNER TO postgres;

