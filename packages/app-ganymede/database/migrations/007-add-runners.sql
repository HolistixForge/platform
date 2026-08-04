-- Migration: enrolled runners, so a machine holds a token of its own
-- Purpose: give the PKCE exchange something to hand back that is not the
-- person's session.
--
-- What enrolment must not produce is a user access token living on a laptop.
-- That token is the person — every project they belong to, every organization
-- they administer — and it sits on a machine that may be shared, backed up, or
-- stolen, for as long as the refresh chain keeps renewing it. Revoking it means
-- signing the person out everywhere, which is a price no one will pay, so in
-- practice it never gets revoked.
--
-- A runner token names one machine instead. Its scope is `runner:<runner_id>`,
-- it carries no organization and no project, and pulling it kills that machine
-- and nothing else. This is the same shape as the per-container hosting tokens,
-- which are scoped to a project and a container rather than to a person.
--
-- runner_id is deliberately also the machine id used by the project machine
-- catalog in collab shared state. Two identifiers for one machine would drift,
-- and the moment they did, a revoked runner would still appear as a live
-- machine that members could place services on.

CREATE TABLE IF NOT EXISTS public.runners
(
    runner_id uuid NOT NULL DEFAULT gen_random_uuid(),
    -- Whose machine. Taken from the authenticated token at enrolment, never
    -- from the request body: a runner that could name its own owner could
    -- enrol itself as somebody else.
    user_id uuid NOT NULL,
    -- What to show in the UI — a hostname, usually.
    label character varying(128) NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Last time the runner authenticated. Distinct from the 30 second liveness
    -- the project machine catalog derives from `last_health_at`: this one only
    -- says the token is still in use somewhere, which is what makes an
    -- abandoned enrolment visible to the person who has to decide about it.
    last_seen_at timestamp without time zone,
    -- Set rather than deleted, because a revoked runner is something the owner
    -- should still be able to see. Nothing signed for it is accepted once this
    -- is non-null, and a JWT cannot be unsigned — the check on this column is
    -- the whole of revocation.
    revoked_at timestamp without time zone,
    PRIMARY KEY (runner_id),
    CONSTRAINT fk_runners_users_user_id FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- The listing the owner sees, and it is always by owner.
CREATE INDEX IF NOT EXISTS idx_runners_user
    ON public.runners(user_id) WHERE revoked_at IS NULL;
