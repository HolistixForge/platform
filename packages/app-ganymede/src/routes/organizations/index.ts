import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth';
import { pg } from '../../database/pg';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';

export const setupOrganizationRoutes = (router: Router) => {
  // GET /orgs - List user's organizations
  router.get('/orgs', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    const result = await pg.query(
      'SELECT * FROM func_organizations_list_by_user($1)',
      [req.user.id]
    );
    const organizations = result.next()?.allRows() || [];
    return res.json({ organizations });
  }));

  // POST /orgs - Create organization
  router.post('/orgs', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    const { name } = req.body;
    const result = await pg.query('CALL proc_organizations_new($1, $2, $3)', [
      req.user.id,
      name,
      null,
    ]);
    const new_organization_id = result.next()?.oneRow()['new_organization_id'];
    return res.json({ organization_id: new_organization_id });
  }));

  // GET /orgs/:org_id - Get organization
  router.get('/orgs/:org_id', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    const result = await pg.query(
      'SELECT * FROM func_organizations_get_by_id($1)',
      [req.params.org_id]
    );
    const org = result.next()?.oneRow();
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    return res.json(org);
  }));

  // DELETE /orgs/:org_id - Delete organization
  router.delete('/orgs/:org_id', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    // Check user is owner
    const orgResult = await pg.query(
      'SELECT owner_user_id FROM organizations WHERE organization_id = $1',
      [req.params.org_id]
    );
    const org = orgResult.next()?.oneRow();
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    if (org['owner_user_id'] !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can delete organization' });
    }

    await pg.query('CALL proc_organizations_delete($1)', [req.params.org_id]);
    return res.json({ success: true });
  }));

  // GET /orgs/:org_id/members - List organization members
  router.get('/orgs/:org_id/members', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    const result = await pg.query(
      'SELECT * FROM func_organizations_members_list($1)',
      [req.params.org_id]
    );
    const members = result.next()?.allRows() || [];
    return res.json({ members });
  }));

  // POST /orgs/:org_id/members - Add member
  router.post('/orgs/:org_id/members', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    const { user_id, role } = req.body;
    await pg.query('CALL proc_organizations_members_add($1, $2, $3)', [
      req.params.org_id,
      user_id,
      role || 'member',
    ]);
    return res.json({ success: true });
  }));

  // DELETE /orgs/:org_id/members/:user_id - Remove member
  router.delete('/orgs/:org_id/members/:user_id', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    await pg.query('CALL proc_organizations_members_remove($1, $2)', [
      req.params.org_id,
      req.params.user_id,
    ]);
    return res.json({ success: true });
  }));

  // PUT /orgs/:org_id/members/:user_id - Update member role
  router.put('/orgs/:org_id/members/:user_id', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    const { role } = req.body;
    await pg.query('CALL proc_organizations_members_update_role($1, $2, $3)', [
      req.params.org_id,
      req.params.user_id,
      role,
    ]);
    return res.json({ success: true });
  }));
};
