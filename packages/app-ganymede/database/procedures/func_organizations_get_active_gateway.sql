DROP FUNCTION IF EXISTS func_organizations_get_active_gateway;

CREATE FUNCTION func_organizations_get_active_gateway(
    in_organization_id uuid
)
RETURNS TABLE (
    gateway_id uuid,
    container_name character varying(100),
    http_port integer,
    vpn_port integer
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.gateway_id,
        g.container_name,
        g.http_port,
        g.vpn_port
    FROM organizations_gateways og
    JOIN gateways g ON og.gateway_id = g.gateway_id
    WHERE og.organization_id = in_organization_id
    AND og.ended_at IS NULL
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

