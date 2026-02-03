import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Table } from '@radix-ui/themes';
import { Link } from 'react-router-dom';

import {
  useCurrentUser,
  useMutationNewProject,
  useMutationNewOrganization,
  useQueryUser,
  useQueryUserProjects,
  useQueryUserOrganizations,
  useQueryOrganization,
  NewProjectFormData,
  NewOrganizationFormData,
} from '@holistix-forge/frontend-data';
import {
  useAction,
  UserInline,
  DialogControlled,
} from '@holistix-forge/ui-base';
import { NewProjectForm, NewOrganizationForm } from '@holistix-forge/ui-views';
import { TApi_Project } from '@holistix-forge/types';

import { HeaderLogic } from '../header/header-logic';
import { DeleteProjectFormLogic } from '../forms/new-project-form';

//

export const HomePage = () => {
  const { data, status } = useCurrentUser();
  const ili = status === 'success' && data.user.user_id !== null;
  return (
    <div>
      <HeaderLogic />

      {ili ? (
        <ProjectsList />
      ) : (
        <div
          className="flex flex-col items-center justify-center"
          style={{ height: 'calc(100vh - 80px)' }}
        >
          <div
            className="flex items-center"
            style={{ gap: '8px', color: 'var(--neutral-5)' }}
          >
            <InfoCircledIcon />
            <p style={{ fontSize: 'var(--font-size-lg)' }}>
              Log in to see your projects
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

//

const ProjectsList = () => {
  const { data, status } = useQueryUserProjects();
  const { data: orgsData, status: orgsStatus } = useQueryUserOrganizations();

  const newProject = useMutationNewProject();
  const newOrganization = useMutationNewOrganization();

  const np_action = useAction<NewProjectFormData>(
    (d) => newProject.mutateAsync(d),
    [newProject],
    {
      checkForm: (d, e) => {
        if (!d.organization_id)
          e.organization_id = 'Please select an organization';
        if (!d.name) e.name = 'Please choose a name';
      },
      values: {
        organization_id: '',
        name: '',
        public: false,
      },
    }
  );

  const no_action = useAction<NewOrganizationFormData>(
    (d) => newOrganization.mutateAsync(d),
    [newOrganization],
    {
      checkForm: (d, e) => {
        if (!d.name) e.name = 'Please choose a name';
      },
      values: {
        name: '',
      },
    }
  );

  //

  if (status === 'success' && orgsStatus === 'success')
    return (
      <>
        {/* Organizations Section */}
        {orgsData && orgsData.length > 0 && (
          <div
            className="organizations-list"
            style={
              {
                '--avatar-width': '30px',
                width: '900px',
                maxWidth: '100%',
                margin: '64px auto 0',
              } as React.CSSProperties
            }
          >
            <div
              className="flex justify-between items-center"
              style={{ marginBottom: '32px' }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  lineHeight: '2rem',
                  fontWeight: 600,
                }}
              >
                My Organizations
              </h2>
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--white)',
                  borderRadius: '6px',
                }}
                onClick={() => no_action.open()}
              >
                + New Organization
              </button>
            </div>
            <Table.Root
              className="overflow-hidden"
              style={{
                tableLayout: 'fixed',
                border: '1px solid var(--neutral-8)',
                borderRadius: '6px',
                marginBottom: '64px',
              }}
            >
              <Table.Header
                style={{
                  width: '900px',
                  backgroundColor: 'var(--surface-600)',
                }}
              >
                <Table.Row>
                  <Table.ColumnHeaderCell
                    style={{ padding: '16px 24px', width: '50%' }}
                  >
                    Organization
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell
                    className="text-center"
                    style={{ padding: '16px 24px', width: '25%' }}
                  >
                    Projects
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell
                    className="text-center"
                    style={{ padding: '16px 24px', width: '25%' }}
                  >
                    Actions
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {orgsData.map((org) => {
                  const projectCount =
                    data?.filter(
                      (p) => p.organization_id === org.organization_id
                    ).length || 0;

                  return (
                    <Table.Row
                      key={org.organization_id}
                      style={{ borderTop: '1px solid var(--neutral-8)' }}
                    >
                      <Table.Cell
                        style={{ padding: '16px 24px', color: 'var(--white)' }}
                      >
                        <Link to={`/org/${org.organization_id}`}>
                          {org.name}
                        </Link>
                      </Table.Cell>
                      <Table.Cell
                        className="text-center"
                        style={{
                          padding: '16px 24px',
                          color: 'var(--neutral-4)',
                        }}
                      >
                        {projectCount}
                      </Table.Cell>
                      <Table.Cell
                        className="text-center"
                        style={{ padding: '16px 24px' }}
                      >
                        <div
                          className="flex items-center justify-center"
                          style={{ gap: '8px' }}
                        >
                          <Link to={`/org/${org.organization_id}`}>
                            <button
                              style={{
                                padding: '4px 12px',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--white)',
                                borderRadius: '4px',
                                backgroundColor: 'var(--cyan-300)',
                              }}
                            >
                              Dashboard
                            </button>
                          </Link>
                          <Link to={`/org/${org.organization_id}/permissions`}>
                            <button
                              style={{
                                padding: '4px 12px',
                                fontSize: 'var(--font-size-sm)',
                                backgroundColor: 'rgba(88, 28, 135, 0.5)',
                                color: '#d8b4fe',
                                borderRadius: '4px',
                              }}
                            >
                              Permissions
                            </button>
                          </Link>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </div>
        )}

        {/* Projects Section */}
        <div
          className="projects-list"
          style={
            {
              '--avatar-width': '30px',
              width: '900px',
              maxWidth: '100%',
              margin: '64px auto 0',
            } as React.CSSProperties
          }
        >
          <div
            className="flex justify-between items-center"
            style={{ marginBottom: '32px' }}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                lineHeight: '2rem',
                fontWeight: 600,
              }}
            >
              My Projects
            </h2>
            {(!orgsData || orgsData.length === 0) && (
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--white)',
                  borderRadius: '6px',
                }}
                onClick={() => no_action.open()}
              >
                + New Organization
              </button>
            )}
          </div>
          <Table.Root
            className="overflow-hidden"
            style={{
              tableLayout: 'fixed',
              border: '1px solid var(--neutral-8)',
              borderRadius: '6px',
            }}
          >
            <Table.Header
              style={{ width: '900px', backgroundColor: 'var(--surface-600)' }}
            >
              <Table.Row>
                <Table.ColumnHeaderCell
                  style={{ padding: '16px 24px', width: '20%' }}
                >
                  Name
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ padding: '16px 24px', width: '18%' }}
                >
                  Organization
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ padding: '16px 24px', width: '15%' }}
                >
                  Owner
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ padding: '16px 24px', width: '8%' }}
                >
                  Public
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ padding: '16px 24px', width: '20%' }}
                >
                  Link
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ padding: '16px 24px', width: '19%' }}
                >
                  Actions
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data?.map((p) => (
                <ProjectsListItem key={p.project_id} project={p} />
              ))}
              <Table.Row style={{ borderTop: '1px solid var(--neutral-8)' }}>
                <Table.Cell style={{ padding: '16px 24px' }}>
                  <button
                    className="flex items-center"
                    style={{ color: 'var(--neutral-5)' }}
                    onClick={() => np_action.open()}
                  >
                    <span style={{ fontSize: '1.5rem', marginRight: '8px' }}>
                      +
                    </span>
                    <span>New Project</span>
                  </button>
                </Table.Cell>
                <Table.Cell style={{ padding: '16px 24px' }}>
                  <div
                    style={{
                      height: '16px',
                      width: '80px',
                      backgroundColor: 'rgba(51, 65, 85, 0.5)',
                      borderRadius: '4px',
                    }}
                  ></div>
                </Table.Cell>
                <Table.Cell style={{ padding: '16px 24px' }}>
                  <div
                    style={{
                      height: '16px',
                      width: '64px',
                      backgroundColor: 'rgba(51, 65, 85, 0.5)',
                      borderRadius: '4px',
                    }}
                  ></div>
                </Table.Cell>
                <Table.Cell style={{ padding: '16px 24px' }}>
                  <div
                    style={{
                      height: '16px',
                      width: '48px',
                      backgroundColor: 'rgba(51, 65, 85, 0.5)',
                      borderRadius: '4px',
                    }}
                  ></div>
                </Table.Cell>
                <Table.Cell style={{ padding: '16px 24px' }}>
                  <div
                    style={{
                      height: '16px',
                      width: '80px',
                      backgroundColor: 'rgba(51, 65, 85, 0.5)',
                      borderRadius: '4px',
                      margin: '0 auto',
                    }}
                  ></div>
                </Table.Cell>
                <Table.Cell style={{ padding: '16px 24px' }}>
                  <div
                    style={{
                      height: '16px',
                      width: '48px',
                      backgroundColor: 'rgba(51, 65, 85, 0.5)',
                      borderRadius: '4px',
                      margin: '0 auto',
                    }}
                  ></div>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </div>
        <DialogControlled
          title="New Project"
          description="Choose a project name and organization"
          open={np_action.isOpened}
          onOpenChange={np_action.close}
        >
          <NewProjectForm action={np_action} organizations={orgsData || []} />
        </DialogControlled>
        <DialogControlled
          title="New Organization"
          description="Create a new organization"
          open={no_action.isOpened}
          onOpenChange={no_action.close}
        >
          <NewOrganizationForm action={no_action} />
        </DialogControlled>
      </>
    );
  return null;
};

const ProjectsListItem = ({
  project,
}: {
  project: Pick<
    TApi_Project,
    'name' | 'project_id' | 'organization_id' | 'public'
  >;
}) => {
  const { data: orgData } = useQueryOrganization(project.organization_id);
  const { data: ownerData, status: ownerStatus } = useQueryUser(
    orgData?.owner_user_id || null
  );

  // Parse organization name: if matches "xxxx:yyyyy-org", extract username
  const renderOrganization = () => {
    if (!orgData) return <span style={{ color: 'var(--neutral-6)' }}>...</span>;

    const orgName = orgData.name;
    const match = orgName.match(/^(.+)-org$/);

    const content =
      match && ownerStatus === 'success' && ownerData ? (
        // Pattern matches: "xxxx:yyyyy-org" → show UserInline"
        <span className="flex items-center" style={{ gap: '4px' }}>
          <UserInline color="var(--white)" {...ownerData} />
        </span>
      ) : (
        // Regular organization name
        <span style={{ color: 'var(--neutral-4)' }}>{orgName}</span>
      );

    // Wrap in link to org dashboard
    return <Link to={`/org/${project.organization_id}`}>{content}</Link>;
  };

  return (
    <Table.Row style={{ borderTop: '1px solid var(--neutral-8)' }}>
      <Table.Cell style={{ padding: '16px 24px', color: 'var(--white)' }}>
        {project.name}
      </Table.Cell>
      <Table.Cell className="ellipsis" style={{ padding: '16px 24px' }}>
        {renderOrganization()}
      </Table.Cell>
      <Table.Cell className="ellipsis" style={{ padding: '16px 24px' }}>
        {ownerStatus === 'success' && ownerData ? (
          <UserInline color="var(--white)" {...ownerData} />
        ) : (
          <span style={{ color: 'var(--neutral-6)' }}>...</span>
        )}
      </Table.Cell>
      <Table.Cell className="text-center" style={{ padding: '16px 24px' }}>
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
            color: project.public ? '#86efac' : 'var(--neutral-4)',
          }}
        >
          {project.public ? 'Public' : 'Private'}
        </span>
      </Table.Cell>
      <Table.Cell className="text-center" style={{ padding: '16px 24px' }}>
        <a
          href={`/p/${project.organization_id}/${project.name}/editor`}
          target="_blank"
          rel="noreferrer"
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
        </a>
      </Table.Cell>
      <Table.Cell className="text-center" style={{ padding: '16px 24px' }}>
        <DeleteProjectFormLogic project_id={project.project_id} />
      </Table.Cell>
    </Table.Row>
  );
};
