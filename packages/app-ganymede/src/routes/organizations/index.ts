import { Router, RequestHandler } from 'express';
import { authenticateJwtUser } from '../../middleware/auth';
import { pg } from '../../database/pg';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';
import { makeOrgGatewayHostname } from '../../lib/url-helpers';

export const setupOrganizationRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  // Note: Rate limiter is applied globally at app level for API routes
  // Individual endpoints use JWT authentication for access control
  // GET /orgs - List user's organizations
  router.get(
    '/orgs',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const result = await pg.query(
        'SELECT * FROM func_organizations_list_by_user($1)',
        [req.user.id]
      );
      const organizations = result.next()?.allRows() || [];
      return res.json({ organizations });
    })
  );

  // POST /orgs - Create organization
  router.post(
    '/orgs',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const { name } = req.body;
      const result = await pg.query('CALL proc_organizations_new($1, $2, $3)', [
        req.user.id,
        name,
        null,
      ]);
      const new_organization_id = result.next()?.oneRow()[
        'new_organization_id'
      ];
      return res.json({ organization_id: new_organization_id });
    })
  );

  // GET /orgs/:org_id - Get organization
  router.get(
    '/orgs/:org_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user is org member (owner or member)
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(req.params.org_id)]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role) {
        return res.status(403).json({ error: 'Not organization member' });
      }

      const result = await pg.query(
        'SELECT * FROM func_organizations_get_by_id($1)',
        [req.params.org_id]
      );
      const org = result.next()?.oneRow();
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      return res.json(org);
    })
  );

  // DELETE /orgs/:org_id - Delete organization
  router.delete(
    '/orgs/:org_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user is owner
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(req.params.org_id)]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (role !== 'owner') {
        const orgResult = await pg.query(
          'SELECT 1 FROM organizations WHERE organization_id = $1',
          [req.params.org_id]
        );
        if (!orgResult.next()?.oneRow()) {
          return res.status(404).json({ error: 'Organization not found' });
        }
        return res
          .status(403)
          .json({ error: 'Only owner can delete organization' });
      }

      await pg.query('CALL proc_organizations_delete($1)', [req.params.org_id]);
      return res.json({ success: true });
    })
  );

  // GET /orgs/:org_id/members - List organization members
  router.get(
    '/orgs/:org_id/members',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user is org member (owner or member)
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(req.params.org_id)]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role) {
        return res.status(403).json({ error: 'Not organization member' });
      }

      const result = await pg.query(
        'SELECT * FROM func_organizations_members_list($1)',
        [req.params.org_id]
      );
      const members = result.next()?.allRows() || [];
      return res.json({ members });
    })
  );

  // POST /orgs/:org_id/members - Add member
  router.post(
    '/orgs/:org_id/members',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user is org owner or admin
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(req.params.org_id)]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role || !['owner', 'admin'].includes(role)) {
        return res
          .status(403)
          .json({ error: 'Only org owner/admin can add members' });
      }

      const { user_id, role: newRole } = req.body;
      await pg.query('CALL proc_organizations_members_add($1, $2, $3)', [
        req.params.org_id,
        user_id,
        newRole || 'member',
      ]);
      return res.json({ success: true });
    })
  );

  // DELETE /orgs/:org_id/members/:user_id - Remove member
  router.delete(
    '/orgs/:org_id/members/:user_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user is org owner or admin
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(req.params.org_id)]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role || !['owner', 'admin'].includes(role)) {
        return res
          .status(403)
          .json({ error: 'Only org owner/admin can remove members' });
      }

      await pg.query('CALL proc_organizations_members_remove($1, $2)', [
        req.params.org_id,
        req.params.user_id,
      ]);
      return res.json({ success: true });
    })
  );

  // PUT /orgs/:org_id/members/:user_id - Update member role
  router.put(
    '/orgs/:org_id/members/:user_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user is org owner (only owner can update roles)
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(req.params.org_id)]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (role !== 'owner') {
        return res
          .status(403)
          .json({ error: 'Only org owner can update member roles' });
      }

      const { role: newRole } = req.body;
      await pg.query(
        'CALL proc_organizations_members_update_role($1, $2, $3)',
        [req.params.org_id, req.params.user_id, newRole]
      );
      return res.json({ success: true });
    })
  );

  // GET /orgs/:org_id/gateway - Get gateway hostname for organization
  router.get(
    '/orgs/:org_id/gateway',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user is org member (owner or member)
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(req.params.org_id)]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role) {
        return res.status(403).json({ error: 'Not organization member' });
      }

      // Check if gateway is active for this organization
      const gatewayResult = await pg.query(
        'SELECT * FROM func_organizations_get_active_gateway($1)',
        [req.params.org_id]
      );
      const gateway = gatewayResult.next()?.oneRow();

      // Gateway hostname is deterministic: org-{organization_id}.domain.local
      // But we only return it if gateway is actually allocated
      if (gateway) {
        const gateway_hostname = makeOrgGatewayHostname(req.params.org_id);
        return res.json({ gateway_hostname });
      } else {
        return res.json({ gateway_hostname: null });
      }
    })
  );
};
