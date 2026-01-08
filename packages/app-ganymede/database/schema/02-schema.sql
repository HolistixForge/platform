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

-- =============================================================================
-- CREDENTIALS WALLET
-- =============================================================================

-- Credential metadata table - defines available credential types (registered by modules)
CREATE TABLE IF NOT EXISTS public.credential_metadata
(
    credential_type character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    icon_url character varying(512),
    validation_schema jsonb,
    required_fields jsonb DEFAULT '[]'::jsonb,
    encryption_required boolean NOT NULL DEFAULT true,
    module_name character varying(100) NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (credential_type)
);

-- Seed default credential types
INSERT INTO public.credential_metadata (credential_type, display_name, description, required_fields, module_name) VALUES
('openai_api_key', 'OpenAI API Key', 'API key for OpenAI services (GPT, DALL-E, Whisper)', '["api_key"]', 'ai'),
('anthropic_api_key', 'Anthropic API Key', 'API key for Anthropic Claude models', '["api_key"]', 'ai'),
('github_token', 'GitHub Token', 'Personal access token for GitHub API', '["token"]', 'vcs'),
('gitlab_token', 'GitLab Token', 'Personal access token for GitLab API', '["token"]', 'vcs'),
('aws_access_key', 'AWS Access Key', 'AWS access key ID and secret for AWS services', '["access_key_id", "secret_access_key"]', 'cloud'),
('google_api_key', 'Google Cloud API Key', 'API key for Google Cloud services', '["api_key"]', 'cloud'),
('slack_token', 'Slack Bot Token', 'Bot or user token for Slack API', '["token"]', 'communication'),
('discord_token', 'Discord Bot Token', 'Bot token for Discord API', '["token"]', 'communication'),
('generic_api_key', 'Generic API Key', 'A generic API key for any third-party service', '["api_key"]', 'generic')
ON CONFLICT (credential_type) DO NOTHING;

-- Credentials table - stores user credentials (encrypted)
CREATE TABLE IF NOT EXISTS public.credentials
(
    credential_id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    credential_type character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    encrypted_value text NOT NULL,
    encryption_key_id character varying(50) NOT NULL DEFAULT 'v1',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at timestamp without time zone,
    is_active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (credential_id),
    CONSTRAINT fk_credentials_users_user_id FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_credentials_metadata_type FOREIGN KEY (credential_type)
        REFERENCES public.credential_metadata (credential_type) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE RESTRICT
);

CREATE INDEX idx_credentials_user_id ON public.credentials(user_id, is_active);
CREATE INDEX idx_credentials_type ON public.credentials(credential_type);

-- Credential shares table - tracks shared credentials
CREATE TABLE IF NOT EXISTS public.credential_shares
(
    share_id uuid NOT NULL DEFAULT gen_random_uuid(),
    credential_id uuid NOT NULL,
    share_scope character varying(50) NOT NULL,
    organization_id uuid,
    project_id uuid,
    resource_id uuid,
    granted_by uuid NOT NULL,
    granted_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamp without time zone,
    is_active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (share_id),
    CONSTRAINT fk_credential_shares_credential_id FOREIGN KEY (credential_id)
        REFERENCES public.credentials (credential_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_credential_shares_granted_by FOREIGN KEY (granted_by)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_credential_shares_organization_id FOREIGN KEY (organization_id)
        REFERENCES public.organizations (organization_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_credential_shares_project_id FOREIGN KEY (project_id)
        REFERENCES public.projects (project_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT chk_share_scope CHECK (
        (share_scope = 'organization' AND organization_id IS NOT NULL AND project_id IS NULL AND resource_id IS NULL) OR
        (share_scope = 'project' AND project_id IS NOT NULL AND organization_id IS NULL AND resource_id IS NULL) OR
        (share_scope = 'resource' AND resource_id IS NOT NULL AND organization_id IS NULL AND project_id IS NULL)
    )
);

CREATE INDEX idx_credential_shares_credential_id ON public.credential_shares(credential_id, is_active);
CREATE INDEX idx_credential_shares_org ON public.credential_shares(organization_id, is_active) WHERE share_scope = 'organization';
CREATE INDEX idx_credential_shares_project ON public.credential_shares(project_id, is_active) WHERE share_scope = 'project';
CREATE INDEX idx_credential_shares_resource ON public.credential_shares(resource_id, is_active) WHERE share_scope = 'resource';

END;
