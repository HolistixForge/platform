DROP FUNCTION IF EXISTS func_gateway_stats;

CREATE OR REPLACE FUNCTION public.func_gateway_stats()
RETURNS TABLE (
    total_gateways bigint,
    used_gateways bigint,
    ready_gateways bigint,
    unused_not_ready_gateways bigint
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_gateways,
        COUNT(pg.gateway_id) AS used_gateways,
        COUNT(*) FILTER (WHERE g.ready = TRUE) AS ready_gateways,
        COUNT(*) FILTER (WHERE pg.gateway_id IS NULL AND g.ready = FALSE) AS unused_not_ready_gateways
    FROM 
        public.gateways g
    LEFT JOIN 
        public.projects_gateways pg ON g.gateway_id = pg.gateway_id AND pg.ended IS NULL;
END;
$BODY$;