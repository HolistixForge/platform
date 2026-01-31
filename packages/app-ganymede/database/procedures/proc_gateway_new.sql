CREATE OR REPLACE PROCEDURE public.proc_gateway_new(
    IN in_version character varying(15),
    IN in_container_name character varying(100),
    IN in_http_port integer,
    IN in_vpn_port integer,
    IN in_gateway_nginx_upstream character varying(255),
    OUT gateway_id uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Generate a new UUID for the gateway
    gateway_id := gen_random_uuid();

    -- Validate that nginx_upstream is provided
    -- This MUST be explicitly set to the address that Stage 1 Nginx will use to reach this gateway
    -- Examples:
    --   Development: '172.17.0.1:7103' (Docker host via bridge gateway)
    --   Production single-server: '172.17.0.1:7103'
    --   Production multi-server: '10.0.0.20:7103' (internal network IP)
    IF in_gateway_nginx_upstream IS NULL OR in_gateway_nginx_upstream = '' THEN
        RAISE EXCEPTION 'gateway_nginx_upstream is required and cannot be NULL or empty';
    END IF;

    -- Insert the new gateway with pool metadata
    INSERT INTO public.gateways (gateway_id, version, ready, container_name, http_port, vpn_port, gateway_nginx_upstream)
    VALUES (gateway_id, in_version, FALSE, in_container_name, in_http_port, in_vpn_port, in_gateway_nginx_upstream);

    -- The gateway_id is automatically returned as an OUT parameter
END;
$BODY$;

ALTER PROCEDURE public.proc_gateway_new(
    character varying, 
    character varying,
    integer,
    integer,
    character varying,
    OUT uuid
)
OWNER TO postgres;
