import { Router, RequestHandler } from 'express';
import { authenticateJwtUser } from '../../middleware/auth';
import { pg } from '../../database/pg';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';

export const setupUserRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  // Note: Rate limiter is applied globally at app level for API routes
  // Individual endpoints use JWT authentication for access control
  // GET /users/search - Search users by username/email
  router.get(
    '/users/search',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const query = req.query.query as string;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      const result = await pg.query('SELECT * FROM func_users_search($1)', [
        query,
      ]);
      const users = result.next()?.allRows() || [];
      return res.json({ users });
    })
  );

  // GET /users/:user_id - Get user by ID
  router.get(
    '/users/:user_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const result = await pg.query(
        'SELECT user_id, username, email, picture, firstname, lastname FROM users WHERE user_id = $1',
        [req.params.user_id]
      );
      const user = result.next()?.oneRow();
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(user);
    })
  );
};
