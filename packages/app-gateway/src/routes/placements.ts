import express, { Request, RequestHandler } from 'express';
import { EPriority, log, NotFoundException } from '@holistix-forge/log';

import { authenticateJwt } from '../middleware/jwt-auth';
import { requireProjectAccess } from '../middleware/permissions';
import { asyncHandler } from '../middleware/route-handler';
import { getGatewayInstances } from '../initialization/gateway-instances';
import { getPlacementProvider } from '@holistix-forge/user-containers';

/**
 * What one machine has been asked to run, in one project.
 *
 * The containers live in the project's collab document, which is a CRDT the
 * gateway holds and the browser subscribes to over a websocket. A headless
 * runner should not have to speak that: it wants its own placements, on a
 * schedule it chooses, on a machine that may have been closed for a week. So
 * this is a read of that document, filtered, over plain HTTP.
 *
 * Filtered, and that is the point rather than an optimisation. A runner that
 * received the whole project would receive every member's placements, on every
 * other member's machine, along with whatever else the document carries. It is
 * handed the rows that name it and nothing else.
 */
export const setupPlacementRoutes = (
  router: express.Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * GET /placements?project_id=…
   *
   * Authenticated with a runner project token, which carries
   * `project:<id>:access` — the scope requireProjectAccess already understands
   * from container tokens — and names the machine it was minted for. The
   * machine is read from the token and never from the query: a runner able to
   * ask for another machine's placements could start that machine's services
   * on its own, which is the whole shape this guards against.
   */
  router.get(
    '/placements',
    authenticateJwt,
    requireProjectAccess(),
    asyncHandler(async (req: Request, res) => {
      const authReq = req as any;
      const jwt = authReq.jwt;

      if (jwt?.type !== 'runner_project_token' || !jwt.runner_id) {
        // A user token would pass requireProjectAccess and then have no machine
        // to filter on. Refusing is clearer than returning an empty list, which
        // would read as "nothing placed on you" to something that is not a
        // machine at all.
        return res
          .status(403)
          .json({ error: 'This endpoint answers to a runner' });
      }

      const project_id = jwt.project_id || (req.query.project_id as string);
      const machine_id = jwt.runner_id;

      const instances = getGatewayInstances();
      if (!instances) {
        throw new NotFoundException([{ message: 'Gateway not initialized' }]);
      }

      // Asked of the module rather than read out of the collab document.
      //
      // This route used to return the raw documents — `{ runner: {…},
      // httpServices, image_id, … }` — and a runner expects `machine_id`,
      // `imageRef`, `settings` and `capabilities` at the top level. Every
      // placement was therefore refused with "Placement names no machine", and
      // would have been unstartable even if it had not been: no resolved
      // image, no SETTINGS. Both halves were tested, each against its own idea
      // of the shape, and neither test could see the other.
      //
      // The reducer builds it, because the pieces live there: the image
      // registry, and the hosting token that is also the container's VPN
      // password, which is kept out of the CRDT because that document reaches
      // every browser in the project.
      const buildPlacements = getPlacementProvider();
      if (!buildPlacements) {
        throw new NotFoundException([
          { message: 'user-containers module is not loaded' },
        ]);
      }

      const placements = await buildPlacements(project_id, machine_id);

      log(
        EPriority.Debug,
        'PLACEMENTS',
        `Machine ${machine_id} has ${placements.length} placement(s) in ${project_id}`
      );

      return res.json({ placements });
    })
  );
};
