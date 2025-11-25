DROP FUNCTION IF EXISTS func_organizations_gateways_get;

CREATE OR REPLACE FUNCTION func_organizations_gateways_get(
    in_tmp_handshake_token uuid
)
RETURNS TABLE (
    organization_id uuid,
    gateway_id uuid
) AS $$
DECLARE
    v_organization_id uuid;
    v_gateway_id uuid;
BEGIN
    SELECT og.organization_id, og.gateway_id 
    INTO v_organization_id, v_gateway_id
    FROM organizations_gateways og
    WHERE 
        og.tmp_handshake_token = in_tmp_handshake_token AND
        og.ended_at IS NULL;
    
    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'invalid_handshake_token';
    END IF;
       
    RETURN QUERY
    SELECT v_organization_id, v_gateway_id;
END;
$$ LANGUAGE plpgsql;

