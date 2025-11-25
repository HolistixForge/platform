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
    'demiurge-global',
    'none',
    '["https://example.com", "https://frontend.example.com"]'::json,
    '["authorization_code", "refresh_token"]'::json
) ON CONFLICT (client_id) DO NOTHING;
