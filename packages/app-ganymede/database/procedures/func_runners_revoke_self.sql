DROP FUNCTION IF EXISTS func_runners_revoke_self;

-- A runner withdrawing itself.
--
-- Separate from func_runners_revoke, which takes an owner and is what the UI
-- calls: this one is reached with a runner token, and the only runner such a
-- token can name is itself. Giving the runner the owner-checked function would
-- mean handing it a user id it does not have, and inventing one for it is how a
-- machine ends up able to revoke its neighbour.
--
-- Returns no row if it was already revoked, so disconnecting twice is not a
-- second event.
CREATE FUNCTION func_runners_revoke_self(
    in_runner_id uuid
)
RETURNS TABLE (
    runner_id uuid,
    revoked_at timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.runners r
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE r.runner_id = in_runner_id
      AND r.revoked_at IS NULL
    RETURNING r.runner_id, r.revoked_at;
END;
$$ LANGUAGE plpgsql;
