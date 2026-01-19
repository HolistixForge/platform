-- Migration: Add gateway_nginx_upstream column
-- Purpose: Store the internal network address that Stage 1 Nginx uses to reach each gateway
-- Examples:
--   Development: '172.17.0.1:7103' (Docker host via bridge gateway)
--   Production single-server: '172.17.0.1:7103' (same as dev)
--   Production multi-server: '10.0.0.20:7103' (cloud internal network IP)
--
-- This allows flexible deployment:
-- - Gateways on same machine (Docker)
-- - Gateways on different VPS (cloud internal network)
-- - Any network topology

-- Add column (if not exists for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gateways' 
        AND column_name = 'gateway_nginx_upstream'
    ) THEN
        ALTER TABLE public.gateways 
        ADD COLUMN gateway_nginx_upstream character varying(255);
        
        RAISE NOTICE 'Column gateway_nginx_upstream added to gateways table';
    ELSE
        RAISE NOTICE 'Column gateway_nginx_upstream already exists';
    END IF;
END $$;

-- For existing gateways in development, set default value to Docker host IP
-- This assumes development environment with Docker bridge network
-- Production environments should set this explicitly when creating gateways
UPDATE public.gateways 
SET gateway_nginx_upstream = '172.17.0.1:' || http_port::text
WHERE gateway_nginx_upstream IS NULL 
  AND http_port IS NOT NULL
  AND container_name LIKE 'gw-pool-%';

COMMENT ON COLUMN public.gateways.gateway_nginx_upstream IS 
'Internal network address (host:port) that Stage 1 Nginx uses to reach this gateway. 
Examples: 172.17.0.1:7103 (dev), 10.0.0.20:7103 (prod internal network)';

