-- OAuth Clients Extension
-- Adds columns for dynamic OAuth client registration (auth guard proxy)
-- These columns extend the existing oauth_clients table from 02-schema.sql

-- Hash of client secret (bcrypt). New clients use this instead of plaintext client_secret.
ALTER TABLE public.oauth_clients
    ADD COLUMN IF NOT EXISTS client_secret_hash VARCHAR(256);

-- Human-readable label for the client
ALTER TABLE public.oauth_clients
    ADD COLUMN IF NOT EXISTS label VARCHAR(256);

-- Who registered this client (e.g., "gateway:{id}")
ALTER TABLE public.oauth_clients
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(128);

-- Expiration timestamp. NULL = no expiry.
ALTER TABLE public.oauth_clients
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Token lifetimes in seconds
ALTER TABLE public.oauth_clients
    ADD COLUMN IF NOT EXISTS access_token_lifetime INTEGER DEFAULT 300;

ALTER TABLE public.oauth_clients
    ADD COLUMN IF NOT EXISTS refresh_token_lifetime INTEGER DEFAULT 3600;

-- Indexes for cleanup and lookup
CREATE INDEX IF NOT EXISTS idx_oauth_clients_created_by ON public.oauth_clients(created_by);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_expires_at ON public.oauth_clients(expires_at) WHERE expires_at IS NOT NULL;
