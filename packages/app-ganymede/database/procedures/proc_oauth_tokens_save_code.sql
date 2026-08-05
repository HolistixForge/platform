-- The six-parameter form has to go before the eight-parameter one is created:
-- CREATE OR REPLACE with a different argument list makes an overload rather
-- than a replacement, and leaving the old one in place means a call that omits
-- the challenge still resolves to a procedure that silently drops it.
DROP PROCEDURE IF EXISTS public.proc_oauth_tokens_save_code(
    character varying,
    character varying,
    character varying,
    timestamp without time zone,
    json,
    character varying
);

CREATE OR REPLACE PROCEDURE public.proc_oauth_tokens_save_code(
    IN in_client_id character varying(128),
	IN in_session_id character varying(50),
	IN in_code character varying(256),
	IN in_code_expires_on timestamp without time zone,
	IN in_scope json,
	IN in_redirect_uri character varying(256),
	-- Null for a client that authenticates with a secret. When set, the token
	-- exchange is only accepted from whoever can produce the verifier this
	-- challenge was derived from.
	IN in_code_challenge character varying(128) DEFAULT NULL,
	IN in_code_challenge_method character varying(16) DEFAULT NULL
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN

    INSERT INTO public.oauth_tokens (
        client_id, session_id, code, code_expires_on, scope, redirect_uri,
        code_challenge, code_challenge_method
    ) VALUES (
        in_client_id, in_session_id, in_code, in_code_expires_on, in_scope, in_redirect_uri,
        in_code_challenge, in_code_challenge_method
    );

END;
$BODY$;

