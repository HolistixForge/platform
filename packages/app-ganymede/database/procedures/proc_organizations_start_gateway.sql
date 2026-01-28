DROP PROCEDURE IF EXISTS public.proc_organizations_start_gateway;

CREATE OR REPLACE PROCEDURE public.proc_organizations_start_gateway(
    IN in_organization_id uuid,
    OUT gateway_id uuid,
    OUT container_name character varying(100),
    OUT http_port integer,
    OUT vpn_port integer,
    OUT gateway_nginx_upstream character varying(255)
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    LOCK TABLE organizations_gateways IN ROW EXCLUSIVE MODE;

    SELECT g.gateway_id, g.container_name, g.http_port, g.vpn_port, g.gateway_nginx_upstream
    INTO gateway_id, container_name, http_port, vpn_port, gateway_nginx_upstream
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

    IF gateway_id IS NULL THEN
        RAISE EXCEPTION 'no_gateway_available';
    END IF;

    INSERT INTO public.organizations_gateways (organization_id, gateway_id, started_at)
    VALUES (in_organization_id, gateway_id, CURRENT_TIMESTAMP);

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
    OUT character varying(255)
) OWNER TO postgres;

