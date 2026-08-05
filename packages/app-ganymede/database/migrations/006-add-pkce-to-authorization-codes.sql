-- Migration: keep the PKCE challenge that is already being sent to us
-- Purpose: let a client that cannot hold a secret — a runner on someone's
-- laptop — finish an authorization code exchange.
--
-- Nothing here is new cryptography. @node-oauth/oauth2-server 5.2.1 reads
-- code_challenge off the authorize request, hands it to saveAuthorizationCode,
-- and re-derives it from code_verifier at the token step. The model declared
-- both values in its signature and then called the stored procedure with six
-- parameters that did not include them, so they were dropped on write. A value
-- that is never stored cannot be read back, and the library skips verification
-- entirely when getAuthorizationCode returns no challenge — the flow looked
-- like it worked while proving nothing.
--
-- Why a public client rather than shipping a secret with the runner: a secret
-- distributed to every laptop is not a secret. PKCE replaces it — the client
-- proves it is the same party that started the flow by producing the verifier
-- behind the challenge, which is generated fresh per attempt and never leaves
-- the machine. An intercepted authorization code is then worth nothing.

-- 43 to 128 characters of unreserved ASCII (RFC 7636 §4.1); 'S256' or 'plain'.
ALTER TABLE public.oauth_tokens
    ADD COLUMN IF NOT EXISTS code_challenge character varying(128);

ALTER TABLE public.oauth_tokens
    ADD COLUMN IF NOT EXISTS code_challenge_method character varying(16);

-- The runner's client. No secret it could leak, one grant, and a loopback
-- redirect: the runner opens a browser, and the authorization code comes back
-- to a server it started on the machine itself, never over the network.
--
-- The registered port is deliberately absent. RFC 8252 §7.3 has the client
-- take whatever ephemeral port the OS gives it and the server ignore the port
-- when matching, because a fixed port is one already-bound socket away from
-- an enrolment that cannot start. validateRedirectUri in models/oauth.ts is
-- what implements that exception, and it applies to loopback hosts only.
--
-- client_secret is '' rather than 'none': 'none' is read by getClient as
-- "accept any secret" for legacy rows, and an empty string can never match a
-- presented secret, so the only way through for this client is PKCE.
INSERT INTO public.oauth_clients (
    client_id,
    client_secret,
    redirect_uris,
    grants,
    label,
    created_by
) VALUES (
    'holistix-runner',
    '',
    '["http://127.0.0.1/callback", "http://[::1]/callback"]'::json,
    '["authorization_code"]'::json,
    'Holistix local runner',
    'migration:006'
) ON CONFLICT (client_id) DO NOTHING;
