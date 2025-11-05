import { Router, Request } from 'express';
import { authenticateJwt } from '../../middleware/auth';
import { pg } from '../../database/pg';
import { generateJwtToken } from '@monorepo/backend-engine';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';

export const setupGatewayRoutes = (router: Router) => {
  // POST /gateway/start - Start gateway for organization
  router.post('/gateway/start', authenticateJwt, asyncHandler(async (req: AuthRequest, res) => {
    const { organization_id } = req.body;

    // Check user is org member
    const memberCheck = await pg.query(
      'SELECT 1 FROM organizations_members WHERE organization_id = $1 AND user_id = $2',
      [organization_id, req.user.id]
    );
    if (!memberCheck.next()?.oneRow()) {
      return res.status(403).json({ error: 'Not organization member' });
    }

    // Allocate gateway
    const result = await pg.query(
      'CALL proc_organizations_start_gateway($1, $2, $3)',
      [organization_id, null, null]
    );
    const row = result.next()?.oneRow();
    const gateway_hostname = row?.['gateway_hostname'];
    const tmp_handshake_token = row?.['tmp_handshake_token'];

    // Call gateway to initialize
    await fetch(`https://${gateway_hostname}/collab/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmp_handshake_token }),
    });

    return res.json({ gateway_hostname });
  }));

  // POST /gateway/config - Gateway calls this with handshake token
  router.post('/gateway/config', asyncHandler(async (req: Request, res) => {
    const { tmp_handshake_token } = req.body;

    // TODO: Validate gateway token

    // Get org from handshake token
    const result = await pg.query(
      'SELECT * FROM func_organizations_gateways_get($1)',
      [tmp_handshake_token]
    );
    const row = result.next()?.oneRow();
    if (!row) {
      return res.status(403).json({ error: 'Invalid handshake token' });
    }

    const organization_id = row['organization_id'];
    const gateway_id = row['gateway_id'];

    // Get organization details
    const orgResult = await pg.query(
      'SELECT * FROM func_organizations_get_by_id($1)',
      [organization_id]
    );
    const org = orgResult.next()?.oneRow();

    // Get organization members
    const membersResult = await pg.query(
      'SELECT * FROM func_organizations_members_list($1)',
      [organization_id]
    );
    const members = membersResult.next()?.allRows() || [];

    // Get organization projects
    const projectsResult = await pg.query(
      'SELECT * FROM func_projects_list_by_organization($1)',
      [organization_id]
    );
    const projects = projectsResult.next()?.allRows() || [];

    // Generate gateway JWT token
    const gatewayToken = generateJwtToken(
      {
        type: 'gateway_token',
        gateway_id: String(gateway_id),
        organization_id: String(organization_id),
        scope: ['gateway:api-access'],
      },
      '365d'
    );

    return res.json({
      organization_id: String(organization_id),
      organization_name: String(org?.['name']),
      gateway_id: String(gateway_id),
      gateway_token: gatewayToken,
      projects: projects.map((p) => String(p['project_id'])),
      members: members.map((m) => ({
        user_id: String(m['user_id']),
        username: String(m['username']),
        role: String(m['role']),
      })),
    });
  }));

  // POST /gateway/ready - Gateway signals it's ready
  router.post('/gateway/ready', asyncHandler(async (req: Request, res) => {
    // TODO: Validate gateway token
    const { gateway_id } = req.body;

    await pg.query('CALL proc_gateways_set_ready($1)', [gateway_id]);
    return res.json({ success: true });
  }));

  // POST /gateway/stop - Stop gateway
  router.post('/gateway/stop', asyncHandler(async (req: Request, res) => {
    // TODO: Validate gateway token
    const { gateway_id } = req.body;

    await pg.query('CALL proc_organizations_gateways_stop($1)', [gateway_id]);
    return res.json({ success: true });
  }));
};
