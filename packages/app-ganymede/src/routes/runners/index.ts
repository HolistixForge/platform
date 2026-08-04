import { Router, RequestHandler } from 'express';
import { EPriority, log } from '@holistix-forge/log';
import { generateJwtToken } from '@holistix-forge/backend-engine';
import { TJwtRunner } from '@holistix-forge/types';

import {
  authenticateJwtRunner,
  authenticateJwtUser,
  AuthRequest,
  RunnerAuthRequest,
} from '../../middleware/auth';
import { asyncHandler } from '../../middleware/route-handler';
import { pg } from '../../database/pg';

/**
 * A year. The point of a long-lived token here is that a machine which was shut
 * for a fortnight comes back working — a runner that has to be re-enrolled
 * every hour is a runner someone stops using. What makes that safe is not the
 * lifetime but the revocation check on every request: this token can be
 * withdrawn the moment its owner says so, which a refresh-token dance cannot
 * claim either.
 */
const RUNNER_TOKEN_LIFETIME = '365d';

const MAX_LABEL_LENGTH = 128;

/**
 * Runner enrolment.
 *
 * The runner arrives here having just finished a PKCE authorization code
 * exchange, holding a short-lived user access token. It trades it for a token
 * of its own and forgets the user one: what stays on the laptop then names a
 * machine rather than a person, and pulling it costs its owner one machine
 * rather than every session they have.
 */
export const setupRunnerRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * POST /runners
   *
   * Enrol this machine. Returns the token once and never again — it is not
   * stored, only its row is, so there is nothing to leak later from a listing.
   */
  router.post(
    '/runners',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const label = String(req.body?.label ?? '').trim();

      if (!label || label.length > MAX_LABEL_LENGTH) {
        return res.status(400).json({
          error: `label is required and must be at most ${MAX_LABEL_LENGTH} characters`,
        });
      }

      // The owner is the authenticated user. Accepting a user_id from the body
      // would let a runner enrol itself onto somebody else's account, and every
      // placement made on it afterwards would be attributed to them.
      const qr = await pg.query('call proc_runners_enrol($1, $2, null)', [
        req.user.id,
        label,
      ]);
      const runner_id = qr.next()?.oneRow()?.['new_runner_id'] as string;

      const payload: TJwtRunner = {
        type: 'runner_token',
        runner_id,
        user_id: req.user.id,
        // Carries no organization and no project on purpose: what this machine
        // may run is decided per placement, by people who are in that project,
        // and a token that already named them would outlive their decision.
        scope: `runner:${runner_id}`,
      };

      log(
        EPriority.Info,
        'RUNNER_ENROL',
        `Runner ${runner_id} (${label}) enrolled by user ${req.user.id}`
      );

      return res.status(201).json({
        runner_id,
        label,
        token: generateJwtToken(payload, RUNNER_TOKEN_LIFETIME),
      });
    })
  );

  /**
   * GET /runners
   *
   * The owner's machines, revoked ones included — a machine that was
   * disconnected is part of what they need to see to know what became of it.
   */
  router.get(
    '/runners',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const qr = await pg.query('select * from func_runners_list_by_user($1)', [
        req.user.id,
      ]);
      const runners = qr.next()?.allRows() ?? [];

      return res.json({ runners });
    })
  );

  /**
   * DELETE /runners/:runner_id
   *
   * Revoke. Ownership is settled inside the statement, so somebody else's
   * runner and a runner that does not exist give the same answer.
   */
  router.delete(
    '/runners/:runner_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const qr = await pg.query('select * from func_runners_revoke($1, $2)', [
        req.params.runner_id,
        req.user.id,
      ]);
      const row = qr.next()?.oneRow();

      if (!row) {
        return res.status(404).json({ error: 'Runner not found' });
      }

      log(
        EPriority.Info,
        'RUNNER_REVOKE',
        `Runner ${req.params.runner_id} revoked by user ${req.user.id}`
      );

      return res.json({
        runner_id: row['runner_id'],
        revoked_at: row['revoked_at'],
      });
    })
  );

  /**
   * GET /runners/me
   *
   * What the runner asks at startup: am I still enrolled? Going through the
   * same middleware as everything else means the answer includes the revocation
   * check rather than only the signature, and the call stamps `last_seen_at`
   * on the way past.
   */
  router.get(
    '/runners/me',
    authenticateJwtRunner,
    asyncHandler(async (req: RunnerAuthRequest, res) =>
      res.json({
        runner_id: req.runner.id,
        user_id: req.runner.user_id,
        label: req.runner.label,
      })
    )
  );
};
