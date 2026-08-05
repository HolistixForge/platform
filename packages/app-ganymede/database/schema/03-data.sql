-- Initial data for refactored schema
-- Organizations and projects created via API

-- =============================================================================
-- OAUTH - Global Client
-- =============================================================================

-- Insert the global OAuth client for user authentication
-- This client is used by the frontend to authenticate users
-- Note: redirect_uris should match CONFIG.APP_FRONTEND_URL and CONFIG.APP_FRONTEND_URL_DEV
-- These will be set via environment variables at runtime
-- For production, update these values after deployment
INSERT INTO public.oauth_clients (
    client_id,
    client_secret,
    redirect_uris,
    grants
) VALUES (
    'app-main-client-id',
    'none',
    '["https://example.com", "https://frontend.example.com"]'::json,
    '["authorization_code", "refresh_token"]'::json
) ON CONFLICT (client_id) DO NOTHING;

-- =============================================================================
-- OAUTH - Local runner (public client)
-- =============================================================================

-- The runner runs on someone's laptop, so it cannot hold a secret: anything
-- shipped with it is readable by whoever has the machine. It authenticates
-- with PKCE instead — see migrations/006-add-pkce-to-authorization-codes.sql.
--
-- client_secret is '' on purpose. 'none' above means "accept any secret" in
-- getClient's legacy path; '' can never match a presented secret, so this
-- client only ever gets through the no-secret PKCE path.
--
-- The redirect carries no port: the runner listens on whatever ephemeral port
-- the OS hands it and the port is ignored when matching (RFC 8252 §7.3).
INSERT INTO public.oauth_clients (
    client_id,
    client_secret,
    redirect_uris,
    grants
) VALUES (
    'holistix-runner',
    '',
    '["http://127.0.0.1/callback", "http://[::1]/callback"]'::json,
    '["authorization_code"]'::json
) ON CONFLICT (client_id) DO NOTHING;
