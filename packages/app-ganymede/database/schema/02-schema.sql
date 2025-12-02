-- Refactored schema for organization-based architecture
-- Gateway per organization, containers/OAuth managed in gateway
BEGIN;

-- Drop all existing constraints first
ALTER TABLE IF EXISTS public.projects_members DROP CONSTRAINT IF EXISTS fk_projects_members_users_user_id;
ALTER TABLE IF EXISTS public.projects_members DROP CONSTRAINT IF EXISTS fk_projects_members_projects_project_id;
ALTER TABLE IF EXISTS public.organizations_members DROP CONSTRAINT IF EXISTS fk_organizations_members_user_id;
ALTER TABLE IF EXISTS public.organizations_members DROP CONSTRAINT IF EXISTS fk_organizations_members_organization_id;
ALTER TABLE IF EXISTS public.organizations_gateways DROP CONSTRAINT IF EXISTS fk_organizations_gateways_gateway_id;
ALTER TABLE IF EXISTS public.organizations_gateways DROP CONSTRAINT IF EXISTS fk_organizations_gateways_organization_id;
ALTER TABLE IF EXISTS public.projects DROP CONSTRAINT IF EXISTS fk_projects_organizations_organization_id;
ALTER TABLE IF EXISTS public.organizations DROP CONSTRAINT IF EXISTS fk_organizations_users_owner_user_id;
ALTER TABLE IF EXISTS public.sessions DROP CONSTRAINT IF EXISTS fk_sessions_users_user_id;
ALTER TABLE IF EXISTS public.totp DROP CONSTRAINT IF EXISTS fk_totp_users_user_id;
ALTER TABLE IF EXISTS public.passwords DROP CONSTRAINT IF EXISTS fk_passwords_users_user_id;

-- Drop all tables
DROP TABLE IF EXISTS public.projects_members CASCADE;
DROP TABLE IF EXISTS public.organizations_gateways CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.organizations_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.gateways CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.magic_links CASCADE;
DROP TABLE IF EXISTS public.totp CASCADE;
DROP TABLE IF EXISTS public.passwords CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- =============================================================================
-- USERS & AUTHENTICATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users
(
    user_id uuid NOT NULL DEFAULT gen_random_uuid(),
    provider_id character varying(100),
    type character varying(50) NOT NULL,
    username character varying(128) NOT NULL,
    email character varying(320) NOT NULL,
    email_validated boolean NOT NULL DEFAULT false,
    signup_date timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    picture character varying(512),
    firstname character varying(50),
    lastname character varying(50),
    PRIMARY KEY (user_id),
    CONSTRAINT unique_username UNIQUE (username),
    CONSTRAINT unique_provider_id UNIQUE (provider_id)
);

CREATE TABLE IF NOT EXISTS public.passwords
(
    user_id uuid NOT NULL,
    hash character(128) NOT NULL,
    salt character(256) NOT NULL,
    reset boolean NOT NULL DEFAULT false,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_passwords_users_user_id FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.totp
(
    user_id uuid NOT NULL,
    key character(100) NOT NULL,
    key_created timestamp without time zone NOT NULL,
    validated boolean,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_totp_users_user_id FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.magic_links
(
    uuid uuid NOT NULL DEFAULT gen_random_uuid(),
    token json NOT NULL,
    expire timestamp without time zone NOT NULL,
    PRIMARY KEY (uuid)
);

CREATE TABLE IF NOT EXISTS public.sessions
(
    session_id character varying(50) NOT NULL,
    user_id uuid,
    session json NOT NULL,
    created timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_access timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_totp timestamp without time zone,
    PRIMARY KEY (session_id),
    CONSTRAINT fk_sessions_users_user_id FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organizations
(
    organization_id uuid NOT NULL DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id),
    CONSTRAINT unique_organization_name UNIQUE (name),
    CONSTRAINT fk_organizations_users_owner_user_id FOREIGN KEY (owner_user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE INDEX idx_organizations_owner ON public.organizations(owner_user_id);

CREATE TABLE IF NOT EXISTS public.organizations_members
(
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) NOT NULL DEFAULT 'member',
    added_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, user_id),
    CONSTRAINT fk_organizations_members_organization_id FOREIGN KEY (organization_id)
        REFERENCES public.organizations (organization_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_organizations_members_user_id FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE INDEX idx_organizations_members_user ON public.organizations_members(user_id);

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.projects
(
    project_id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    public boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id),
    CONSTRAINT unique_org_project_name UNIQUE (organization_id, name),
    CONSTRAINT fk_projects_organizations_organization_id FOREIGN KEY (organization_id)
        REFERENCES public.organizations (organization_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE INDEX idx_projects_organization ON public.projects(organization_id);

CREATE TABLE IF NOT EXISTS public.projects_members
(
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_projects_members_projects_project_id FOREIGN KEY (project_id)
        REFERENCES public.projects (project_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_projects_members_users_user_id FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE INDEX idx_projects_members_user ON public.projects_members(user_id);

-- =============================================================================
-- GATEWAYS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gateways
(
    gateway_id uuid NOT NULL DEFAULT gen_random_uuid(),
    version character varying(15) NOT NULL,
    ready boolean NOT NULL DEFAULT false,
    container_name character varying(100),
    http_port integer,
    vpn_port integer,
    PRIMARY KEY (gateway_id),
    CONSTRAINT unique_container_name UNIQUE (container_name)
);

CREATE TABLE IF NOT EXISTS public.organizations_gateways
(
    organization_id uuid NOT NULL,
    gateway_id uuid NOT NULL,
    tmp_handshake_token uuid NOT NULL,
    started_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamp without time zone,
    PRIMARY KEY (organization_id, gateway_id, started_at),
    CONSTRAINT unique_handshake_token UNIQUE (tmp_handshake_token),
    CONSTRAINT fk_organizations_gateways_organization_id FOREIGN KEY (organization_id)
        REFERENCES public.organizations (organization_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_organizations_gateways_gateway_id FOREIGN KEY (gateway_id)
        REFERENCES public.gateways (gateway_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE INDEX idx_organizations_gateways_active ON public.organizations_gateways (organization_id, gateway_id)
    WHERE ended_at IS NULL;

-- =============================================================================
-- OAUTH
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.oauth_clients
(
    client_id character varying(128) NOT NULL,
    client_secret text NOT NULL,
    redirect_uris json NOT NULL,
    grants json NOT NULL DEFAULT '["authorization_code","refresh_token"]',
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (client_id)
);

CREATE TABLE IF NOT EXISTS public.oauth_tokens
(
    client_id character varying(128) NOT NULL,
    session_id character varying(50) NOT NULL,
    code character varying(256),
    code_expires_on timestamp without time zone,
    scope json NOT NULL,
    redirect_uri character varying(256),
    access_token text,
    access_token_expires_on timestamp without time zone,
    refresh_token text,
    refresh_token_expires_on timestamp without time zone,
    CONSTRAINT fk_oauth_tokens_oauth_clients_client_id FOREIGN KEY (client_id)
        REFERENCES public.oauth_clients (client_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_oauth_tokens_sessions_session_id FOREIGN KEY (session_id)
        REFERENCES public.sessions (session_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE INDEX idx_oauth_tokens_code ON public.oauth_tokens(code) WHERE code IS NOT NULL;
CREATE INDEX idx_oauth_tokens_refresh_token ON public.oauth_tokens(refresh_token) WHERE refresh_token IS NOT NULL;
CREATE INDEX idx_oauth_tokens_access_token ON public.oauth_tokens(access_token) WHERE access_token IS NOT NULL;

END;
