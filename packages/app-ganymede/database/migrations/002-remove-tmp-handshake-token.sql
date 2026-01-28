-- Remove tmp_handshake_token column (no longer needed with TJwtGateway auth)
ALTER TABLE organizations_gateways DROP COLUMN IF EXISTS tmp_handshake_token;
