-- Migration: private networks, addressed out of the organization's VPN space
-- Purpose: give a named network a real range, so isolation is routing rather
-- than a list of rules.
--
-- Why the range and not a label: on a flat network every container can reach
-- every other and only a rule stops it, so a missing rule exposes everything —
-- it fails open. With a range, a machine without a route to 172.16.7.0/24
-- cannot send a packet there at all; it fails closed. It also means two
-- services of one network on the same machine talk over the local bridge
-- instead of making a round trip through the gateway, which on a laptop means
-- over the internet.
--
-- Why the table lives here and not in collab shared state: the /16 belongs to
-- the organization, while shared state is per project. A gateway holding one
-- project's room cannot see what another project already took, and an
-- in-memory allocator forgets everything on restart. The unique constraint
-- below is what actually prevents two concurrent allocations picking the same
-- range — the read-then-write in the allocator cannot do it alone.

CREATE TABLE IF NOT EXISTS public.project_networks
(
    organization_id uuid NOT NULL,
    project_id uuid NOT NULL,
    -- Also the DNS label: a network is addressed at <name>.org-<uuid>.<domain>.
    name character varying(32) NOT NULL,
    -- A /24 from 172.16.16.0/20 upward. Below that is OpenVPN's client pool,
    -- which grows from the bottom of the /16 as containers connect.
    cidr cidr NOT NULL,
    created_by uuid,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, name),
    -- The constraint that makes allocation safe under concurrency.
    CONSTRAINT unique_organization_network_cidr UNIQUE (organization_id, cidr),
    CONSTRAINT project_networks_name_is_dns_label CHECK (
        name ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$'
    ),
    CONSTRAINT fk_project_networks_organizations FOREIGN KEY (organization_id)
        REFERENCES public.organizations (organization_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_project_networks_projects FOREIGN KEY (project_id)
        REFERENCES public.projects (project_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_project_networks_users FOREIGN KEY (created_by)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_project_networks_organization
    ON public.project_networks(organization_id);
