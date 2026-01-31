DROP FUNCTION IF EXISTS func_organizations_get_allocation_by_gateway_id;

CREATE OR REPLACE FUNCTION func_organizations_get_allocation_by_gateway_id(
    in_gateway_id uuid
)
RETURNS TABLE (
    organization_id uuid,
    gateway_id uuid,
    started_at timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        og.organization_id,
        og.gateway_id,
        og.started_at
    FROM organizations_gateways og
    WHERE 
        og.gateway_id = in_gateway_id AND
        og.ended_at IS NULL
    ORDER BY og.started_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
