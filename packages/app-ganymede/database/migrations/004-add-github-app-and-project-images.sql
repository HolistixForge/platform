-- Migration: GitHub App installations and per-project container images
-- Purpose: let a project run images from its own GitHub organization's GHCR.
--
-- Why a GitHub App rather than a personal access token: cost to the user. A PAT
-- means creating a machine account, generating a token with read:packages,
-- inviting it to the organization, granting it repositories, copying the token,
-- pasting it here, sharing it — and doing it again at every expiry. An App
-- installation is three clicks, once, and GitHub tells us which organization
-- and which repositories were chosen.
--
-- It also means no tenant secret is stored at all. We keep an installation id,
-- which is not a credential, and mint short-lived tokens from the platform's
-- own App key when a pull needs one.

-- ---------------------------------------------------------------------------
-- Installations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.github_app_installations
(
    installation_id bigint NOT NULL,
    -- The GitHub organization (or user) the App was installed on, lowercase.
    -- This is what projects.github_organization points at, and GitHub gives it
    -- to us directly — so the binding is never typed by hand.
    account_login character varying(39) NOT NULL,
    installed_by uuid,
    installed_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Set when GitHub tells us the installation was suspended or deleted. Kept
    -- rather than removed so a pull failure reads as "access was withdrawn"
    -- instead of "this was never configured".
    revoked_at timestamp without time zone,
    PRIMARY KEY (installation_id),
    CONSTRAINT unique_github_account_login UNIQUE (account_login),
    CONSTRAINT github_app_installations_account_login_format CHECK (
        account_login ~ '^[a-z0-9]([a-z0-9]|-(?=[a-z0-9])){0,38}$'
    ),
    CONSTRAINT fk_github_app_installations_users FOREIGN KEY (installed_by)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Per-project image catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_container_images
(
    project_id uuid NOT NULL,
    -- The catalog key. This is what a gateway sends the broker, and what the
    -- broker resolves here — never an image URI chosen by the caller.
    image_id character varying(100) NOT NULL,
    image_name character varying(255) NOT NULL,
    description text,
    -- Always ghcr.io/<project's github_organization>/…, enforced below.
    image_uri character varying(512) NOT NULL,
    image_tag character varying(128) NOT NULL,
    -- Resolved from the tag when the image is registered, so a tenant supplies
    -- a tag and we pin it. NOT NULL: an image that is not pinned to an exact
    -- artifact is not the same thing from one start to the next.
    image_sha256 character(64) NOT NULL,
    created_by uuid,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, image_id),
    CONSTRAINT project_container_images_uri_is_ghcr CHECK (
        image_uri LIKE 'ghcr.io/%'
    ),
    CONSTRAINT project_container_images_digest_format CHECK (
        image_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT fk_project_container_images_projects FOREIGN KEY (project_id)
        REFERENCES public.projects (project_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_project_container_images_users FOREIGN KEY (created_by)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_project_container_images_project
    ON public.project_container_images(project_id);
