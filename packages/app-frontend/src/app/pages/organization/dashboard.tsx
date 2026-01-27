import { useParams, Link } from 'react-router-dom';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Table } from '@radix-ui/themes';

import {
  useCurrentUser,
  useQueryOrganization,
  useQueryUserProjects,
  useMutationStartOrganization,
} from '@holistix-forge/frontend-data';
import { ButtonBase, useAction, icons } from '@holistix-forge/ui-base';

import { HeaderLogic } from '../../header/header-logic';

/**
 * OrganizationDashboard - Overview page for an organization
 *
 * Shows:
 * - Organization info
 * - List of projects in this organization
 * - Quick actions (manage permissions, start/stop gateway)
 */
export const OrganizationDashboard = () => {
  const { organization_id } = useParams<{ organization_id: string }>();
  const { data: currentUser } = useCurrentUser();
  const { data: org, status: orgStatus } = useQueryOrganization(
    organization_id!
  );
  const { data: allProjects } = useQueryUserProjects();

  // Filter projects for this organization
  const orgProjects =
    allProjects?.filter((p) => p.organization_id === organization_id) || [];

  const startOrganization = useMutationStartOrganization(organization_id!);
  const startAction = useAction(
    () => startOrganization.mutateAsync(),
    [startOrganization]
  );

  if (orgStatus === 'pending') {
    return (
      <div>
        <HeaderLogic />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
          <InfoCircledIcon className="w-[38px] h-[38px]" />
          <p className="text-lg">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div>
        <HeaderLogic />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
          <p className="text-lg text-red-400">Organization not found</p>
        </div>
      </div>
    );
  }

  const isOwner = org.owner_user_id === currentUser?.user.user_id;

  return (
    <div>
      <HeaderLogic />

      <div className="container mx-auto px-8 py-12 max-w-[1200px]">
        {/* Organization Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{org.name}</h1>
          <div className="flex items-center gap-4 text-slate-400 text-sm">
            <span>
              {orgProjects.length} project{orgProjects.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-8">
          <Link to={`/org/${organization_id}/permissions`}>
            <ButtonBase
              text="Manage Permissions"
              className="blue"
              Icon={icons.Key}
            />
          </Link>

          {isOwner && (
            <ButtonBase
              text="Start Gateway"
              className="green"
              {...startAction}
            />
          )}
        </div>

        {/* Projects Table */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Projects</h2>
            <Link to="/">
              <ButtonBase text="+ New Project" className="blue small" />
            </Link>
          </div>

          {orgProjects.length > 0 ? (
            <Table.Root className="border border-slate-700 rounded-md overflow-hidden">
              <Table.Header className="-bg--c-alt-blue-4">
                <Table.Row>
                  <Table.ColumnHeaderCell className="py-4 px-6">
                    Project Name
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell className="py-4 px-6 text-center">
                    Public
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell className="py-4 px-6 text-center">
                    Actions
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {orgProjects.map((project) => (
                  <Table.Row
                    key={project.project_id}
                    className="border-t border-slate-700 hover:bg-slate-800/50"
                  >
                    <Table.Cell className="py-4 px-6 text-white">
                      {project.name}
                    </Table.Cell>
                    <Table.Cell className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          project.public
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {project.public ? 'Public' : 'Private'}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="py-4 px-6 text-center">
                      <a
                        href={`/p/${organization_id}/${project.name}/editor`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium -bg--c-alt-blue-1 hover:-bg--c-alt-blue-2 text-white transition-colors"
                      >
                        Open
                      </a>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 border border-slate-700 rounded-md bg-slate-900/20">
              <p className="text-slate-400 mb-4">No projects yet</p>
              <Link to="/">
                <ButtonBase text="Create First Project" className="blue" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
