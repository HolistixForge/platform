import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Table } from '@radix-ui/themes';

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
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
          <div className="flex items-center gap-2 text-slate-400">
            <InfoCircledIcon />
            <p className="text-lg">Log in to see your projects</p>
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
        <div
          className="projects-list w-[350px] sm:w-[900px] mx-auto mt-16"
          style={{ '--avatar-width': '30px' } as React.CSSProperties}
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-semibold">My Projects</h2>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              onClick={() => no_action.open()}
            >
              + New Organization
            </button>
          </div>
          <Table.Root className="table-fixed border border-slate-700 rounded-md overflow-hidden">
            <Table.Header className="w-[350px] sm:w-[900px] -bg--c-alt-blue-4">
              <Table.Row>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[40%] sm:w-[20%]">
                  Name
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[0%] sm:w-[18%] hidden sm:table-cell">
                  Organization
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[0%] sm:w-[15%] hidden sm:table-cell">
                  Owner
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[0%] sm:w-[8%] hidden sm:table-cell">
                  Public
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[35%] sm:w-[20%]">
                  Link
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[25%] sm:w-[19%]">
                  Actions
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data?.map((p) => (
                <ProjectsListItem key={p.project_id} project={p} />
              ))}
              <Table.Row className="border-t border-slate-700 hover:bg-slate-800/50">
                <Table.Cell className="py-4 px-6">
                  <button
                    className="flex items-center text-slate-400 hover:text-white transition-colors"
                    onClick={() => np_action.open()}
                  >
                    <span className="text-2xl mr-2">+</span>
                    <span>New Project</span>
                  </button>
                </Table.Cell>
                <Table.Cell className="py-4 px-6 hidden sm:table-cell">
                  <div className="h-4 w-20 bg-slate-700/50 rounded"></div>
                </Table.Cell>
                <Table.Cell className="py-4 px-6 hidden sm:table-cell">
                  <div className="h-4 w-16 bg-slate-700/50 rounded"></div>
                </Table.Cell>
                <Table.Cell className="py-4 px-6 hidden sm:table-cell">
                  <div className="h-4 w-12 bg-slate-700/50 rounded"></div>
                </Table.Cell>
                <Table.Cell className="py-4 px-6">
                  <div className="h-4 w-20 bg-slate-700/50 rounded mx-auto"></div>
                </Table.Cell>
                <Table.Cell className="py-4 px-6">
                  <div className="h-4 w-12 bg-slate-700/50 rounded mx-auto"></div>
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
    if (!orgData) return <span className="text-slate-500">...</span>;

    const orgName = orgData.name;
    const match = orgName.match(/^(.+)-org$/);

    if (match && ownerStatus === 'success' && ownerData) {
      // Pattern matches: "xxxx:yyyyy-org" → show UserInline"
      return (
        <span className="flex items-center gap-1">
          <UserInline color="var(--c-white-1)" {...ownerData} />
        </span>
      );
    }

    // Regular organization name
    return <span className="text-slate-300">{orgName}</span>;
  };

  return (
    <Table.Row className="border-t border-slate-700 hover:bg-slate-800/50">
      <Table.Cell className="py-4 px-6" style={{ color: 'var(--c-white-1)' }}>
        {project.name}
      </Table.Cell>
      <Table.Cell className="py-4 px-6 ellipsis hidden sm:table-cell">
        {renderOrganization()}
      </Table.Cell>
      <Table.Cell className="py-4 px-6 ellipsis hidden sm:table-cell">
        {ownerStatus === 'success' && ownerData ? (
          <UserInline color="var(--c-white-1)" {...ownerData} />
        ) : (
          <span className="text-slate-500">...</span>
        )}
      </Table.Cell>
      <Table.Cell className="py-4 px-6 text-center hidden sm:table-cell">
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
          href={`/p/${project.organization_id}/${project.name}/editor`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium -bg--c-alt-blue-1 hover:-bg--c-alt-blue-2 text-white transition-colors"
        >
          Open
        </a>
      </Table.Cell>
      <Table.Cell className="py-4 px-6 text-center">
        <DeleteProjectFormLogic project_id={project.project_id} />
      </Table.Cell>
    </Table.Row>
  );
};
