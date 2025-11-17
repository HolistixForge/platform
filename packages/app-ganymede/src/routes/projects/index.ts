import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth';
import { pg } from '../../database/pg';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';

export const setupProjectRoutes = (router: Router) => {
  // GET /projects - List user's projects
  router.get(
    '/projects',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      const result = await pg.query(
        'SELECT * FROM func_projects_list_by_user($1)',
        [req.user.id]
      );
      const projects = result.next()?.allRows() || [];
      return res.json({ projects });
    })
  );

  // POST /projects - Create project
  router.post(
    '/projects',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      const { organization_id, name, public: isPublic } = req.body;

      // Check user is org member (owner or member)
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, organization_id]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role) {
        return res.status(403).json({ error: 'Not organization member' });
      }

      const result = await pg.query('CALL proc_projects_new($1, $2, $3, $4)', [
        organization_id,
        name,
        isPublic,
        null,
      ]);
      const new_project_id = result.next()?.oneRow()['new_project_id'];
      return res.json({ project_id: new_project_id });
    })
  );

  // GET /projects/:project_id - Get project
  router.get(
    '/projects/:project_id',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user has project access
      const accessCheck = await pg.query(
        'SELECT func_user_has_project_access($1, $2) as has_access',
        [req.user.id, req.params.project_id]
      );
      if (!accessCheck.next()?.oneRow()['has_access']) {
        return res.status(403).json({ error: 'No access to project' });
      }

      const result = await pg.query(
        'SELECT * FROM func_projects_get_by_id($1)',
        [req.params.project_id]
      );
      const project = result.next()?.oneRow();
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      return res.json(project);
    })
  );

  // DELETE /projects/:project_id - Delete project
  router.delete(
    '/projects/:project_id',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      // Get project to find organization_id
      const projectResult = await pg.query(
        'SELECT organization_id FROM projects WHERE project_id = $1',
        [req.params.project_id]
      );
      const project = projectResult.next()?.oneRow();
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check user is org owner or admin
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(project['organization_id'])]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role || !['owner', 'admin'].includes(role)) {
        return res
          .status(403)
          .json({ error: 'Only org owner/admin can delete projects' });
      }

      await pg.query('CALL proc_projects_delete($1)', [req.params.project_id]);
      return res.json({ success: true });
    })
  );

  // GET /projects/:project_id/members - List project members
  router.get(
    '/projects/:project_id/members',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      // Check user has project access
      const accessCheck = await pg.query(
        'SELECT func_user_has_project_access($1, $2) as has_access',
        [req.user.id, req.params.project_id]
      );
      if (!accessCheck.next()?.oneRow()['has_access']) {
        return res.status(403).json({ error: 'No access to project' });
      }

      const result = await pg.query(
        'SELECT * FROM func_projects_members_list($1)',
        [req.params.project_id]
      );
      const members = result.next()?.allRows() || [];
      return res.json({ members });
    })
  );

  // POST /projects/:project_id/members - Add member to project
  router.post(
    '/projects/:project_id/members',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      // Get project to find organization_id
      const projectResult = await pg.query(
        'SELECT organization_id FROM projects WHERE project_id = $1',
        [req.params.project_id]
      );
      const project = projectResult.next()?.oneRow();
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check user is org owner or admin
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(project['organization_id'])]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role || !['owner', 'admin'].includes(role)) {
        return res
          .status(403)
          .json({ error: 'Only org owner/admin can add project members' });
      }

      const { user_id } = req.body;
      await pg.query('CALL proc_projects_members_edit($1, $2, $3)', [
        req.params.project_id,
        user_id,
        true, // add = true
      ]);
      return res.json({ success: true });
    })
  );

  // DELETE /projects/:project_id/members/:user_id - Remove member
  router.delete(
    '/projects/:project_id/members/:user_id',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      // Get project to find organization_id
      const projectResult = await pg.query(
        'SELECT organization_id FROM projects WHERE project_id = $1',
        [req.params.project_id]
      );
      const project = projectResult.next()?.oneRow();
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check user is org owner or admin
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(project['organization_id'])]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (!role || !['owner', 'admin'].includes(role)) {
        return res
          .status(403)
          .json({ error: 'Only org owner/admin can remove project members' });
      }

      await pg.query('CALL proc_projects_members_edit($1, $2, $3)', [
        req.params.project_id,
        req.params.user_id,
        false, // add = false
      ]);
      return res.json({ success: true });
    })
  );
};
