DROP FUNCTION IF EXISTS func_runners_touch;

-- Authenticating a runner and recording that it was here are the same
-- statement. Two would mean a read followed by a write, and a token that was
-- revoked between them would be honoured once more; one UPDATE ... RETURNING
-- decides and stamps under the same row lock.
--
-- Returns nothing when the runner is unknown or revoked, which is what the
-- caller turns into a refusal. A signed token outlives any button in the UI, so
-- this row is the only thing that can withdraw it.
CREATE FUNCTION func_runners_touch(
    in_runner_id uuid
)
RETURNS TABLE (
    runner_id uuid,
    user_id uuid,
    label character varying(128)
)
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.runners r
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE r.runner_id = in_runner_id
      AND r.revoked_at IS NULL
    RETURNING r.runner_id, r.user_id, r.label;
END;
$$ LANGUAGE plpgsql;
