CREATE OR REPLACE PROCEDURE public.proc_gateway_new(
    IN in_version character varying(15),
    IN in_container_name character varying(100),
    IN in_http_port integer,
    IN in_vpn_port integer,
    OUT gateway_id uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    -- Generate a new UUID for the gateway
    gateway_id := gen_random_uuid();

    -- Insert the new gateway with pool metadata
    INSERT INTO public.gateways (gateway_id, version, ready, container_name, http_port, vpn_port)
    VALUES (gateway_id, in_version, FALSE, in_container_name, in_http_port, in_vpn_port);

    -- The gateway_id is automatically returned as an OUT parameter
END;
$BODY$;

ALTER PROCEDURE public.proc_gateway_new(
    character varying, 
    character varying,
    integer,
    integer,
    OUT uuid
)
OWNER TO postgres;
