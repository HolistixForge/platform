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
import { PageFrame } from '../page-frame';
import { OrganizationSidebar } from './sidebar';

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
        <div
          className="flex flex-col items-center justify-center"
          style={{ height: 'calc(100vh - 80px)' }}
        >
          <InfoCircledIcon style={{ width: '38px', height: '38px' }} />
          <p style={{ fontSize: 'var(--font-size-lg)' }}>
            Loading organization...
          </p>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div>
        <HeaderLogic />
        <div
          className="flex flex-col items-center justify-center"
          style={{ height: 'calc(100vh - 80px)' }}
        >
          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--primary-500)',
            }}
          >
            Organization not found
          </p>
        </div>
      </div>
    );
  }

  const isOwner = org.owner_user_id === currentUser?.user.user_id;

  return (
    <div>
      <HeaderLogic />

      <PageFrame
        rail="dashboard"
        sidebar={(variant) => (
          <OrganizationSidebar active="organization" variant={variant} />
        )}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '48px 32px',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          {/* Organization Header */}
          <div style={{ marginBottom: '32px' }}>
            <h1
              className="font-bold"
              style={{
                fontSize: '1.875rem',
                lineHeight: '2.25rem',
                color: 'var(--white)',
                marginBottom: '8px',
              }}
            >
              {org.name}
            </h1>
            <div
              className="flex items-center"
              style={{
                gap: '16px',
                color: 'var(--neutral-5)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <span>
                {orgProjects.length} project
                {orgProjects.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex" style={{ gap: '16px', marginBottom: '32px' }}>
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
          <div style={{ marginBottom: '32px' }}>
            <div
              className="flex justify-between items-center"
              style={{ marginBottom: '16px' }}
            >
              <h2
                style={{
                  fontSize: '1.25rem',
                  lineHeight: '1.75rem',
                  fontWeight: 600,
                  color: 'var(--white)',
                }}
              >
                Projects
              </h2>
              <Link to="/">
                <ButtonBase text="+ New Project" className="blue small" />
              </Link>
            </div>

            {orgProjects.length > 0 ? (
              <Table.Root
                className="overflow-hidden"
                style={{
                  border: '1px solid var(--neutral-8)',
                  borderRadius: '6px',
                }}
              >
                <Table.Header style={{ backgroundColor: 'var(--surface-600)' }}>
                  <Table.Row>
                    <Table.ColumnHeaderCell style={{ padding: '16px 24px' }}>
                      Project Name
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell
                      className="text-center"
                      style={{ padding: '16px 24px' }}
                    >
                      Public
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell
                      className="text-center"
                      style={{ padding: '16px 24px' }}
                    >
                      Actions
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {orgProjects.map((project) => (
                    <Table.Row
                      key={project.project_id}
                      style={{ borderTop: '1px solid var(--neutral-8)' }}
                    >
                      <Table.Cell
                        style={{ padding: '16px 24px', color: 'var(--white)' }}
                      >
                        {project.name}
                      </Table.Cell>
                      <Table.Cell
                        className="text-center"
                        style={{ padding: '16px 24px' }}
                      >
                        <span
                          className="items-center font-medium"
                          style={{
                            display: 'inline-flex',
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            borderRadius: '9999px',
                            backgroundColor: project.public
                              ? 'rgba(20, 83, 45, 0.5)'
                              : 'var(--neutral-8)',
                            color: project.public
                              ? '#86efac'
                              : 'var(--neutral-4)',
                          }}
                        >
                          {project.public ? 'Public' : 'Private'}
                        </span>
                      </Table.Cell>
                      <Table.Cell
                        className="text-center"
                        style={{ padding: '16px 24px' }}
                      >
                        <Link
                          to={`/p/${organization_id}/${project.name}/editor`}
                          className="items-center justify-center font-medium"
                          style={{
                            display: 'inline-flex',
                            borderRadius: '6px',
                            padding: '8px 16px',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--white)',
                            backgroundColor: 'var(--cyan-300)',
                          }}
                        >
                          Open
                        </Link>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            ) : (
              <div
                className="flex flex-col items-center justify-center"
                style={{
                  padding: '64px 0',
                  border: '1px solid var(--neutral-8)',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.2)',
                }}
              >
                <p style={{ color: 'var(--neutral-5)', marginBottom: '16px' }}>
                  No projects yet
                </p>
                <Link to="/">
                  <ButtonBase text="Create First Project" className="blue" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </PageFrame>
    </div>
  );
};
