DROP FUNCTION IF EXISTS func_runners_revoke;

-- A function rather than a procedure because the caller needs to know whether
-- anything happened: the owner check is in the WHERE clause, so a runner that
-- belongs to somebody else returns no row and is refused. Doing the ownership
-- check as a separate SELECT would leave a window where the runner changes
-- hands between the two statements, and would answer "not found" and "not
-- yours" differently — which tells a caller whose runners exist.
--
-- Already revoked returns no row as well: revoking twice is not an event, and
-- the first revocation's timestamp is the true one.
CREATE FUNCTION func_runners_revoke(
    in_runner_id uuid,
    in_user_id uuid
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
      AND r.user_id = in_user_id
      AND r.revoked_at IS NULL
    RETURNING r.runner_id, r.revoked_at;
END;
$$ LANGUAGE plpgsql;
