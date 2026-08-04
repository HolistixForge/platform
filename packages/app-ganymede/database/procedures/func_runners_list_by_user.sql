DROP FUNCTION IF EXISTS func_runners_list_by_user;

-- Revoked runners are listed too, and marked. A machine that was disconnected
-- is part of what the owner needs to see to know what happened to it; hiding it
-- makes a revocation look like a deletion.
CREATE FUNCTION func_runners_list_by_user(
    in_user_id uuid
)
RETURNS TABLE (
    runner_id uuid,
    label character varying(128),
    created_at timestamp without time zone,
    last_seen_at timestamp without time zone,
    revoked_at timestamp without time zone
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.runner_id,
        r.label,
        r.created_at,
        r.last_seen_at,
        r.revoked_at
    FROM public.runners r
    WHERE r.user_id = in_user_id
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;
