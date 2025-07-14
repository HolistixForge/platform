import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Table } from '@radix-ui/themes';

import {
  useCurrentUser,
  useMutationNewProject,
  useQueryUser,
  useQueryUserProjects,
  NewProjectFormData,
} from '@monorepo/frontend-data';
import { useAction, UserInline, DialogControlled } from '@monorepo/ui-base';
import { NewProjectForm } from '@monorepo/ui-views';
import { TApi_Project } from '@monorepo/demiurge-types';

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
        <>
          <ProjectsList />
        </>
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

  const newProject = useMutationNewProject();

  const np_action = useAction<NewProjectFormData>(
    (d) => newProject.mutateAsync(d),
    [newProject],
    {
      checkForm: (d, e) => {
        if (!d.name) e.name = 'Please choose a name';
      },
      values: {
        public: false,
      },
    }
  );

  //

  if (status === 'success')
    return (
      <>
        <div
          className="projects-list w-[350px] sm:w-[900px] mx-auto mt-16"
          style={{ '--avatar-width': '30px' } as React.CSSProperties}
        >
          <h2 className="text-2xl font-semibold mb-8">My Organizations</h2>
          <Table.Root className="table-fixed border border-slate-700 rounded-md overflow-hidden">
            <Table.Header className="w-[350px] sm:w-[900px] -bg--c-alt-blue-4">
              <Table.Row>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[33%] sm:w-[35%]">
                  Name
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[0%] sm:w-[25%] hidden sm:table-cell">
                  Owner
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[33%] sm:w-[25%]">
                  Link
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="py-4 px-6 w-[33%] sm:w-[15%] hidden sm:table-cell">
                  Actions
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data._0.map((p) => (
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
                <Table.Cell className="py-4 px-6">
                  <div className="h-4 w-20 bg-slate-700/50 rounded mx-auto"></div>
                </Table.Cell>
                <Table.Cell className="py-4 px-6 hidden sm:table-cell">
                  <div className="h-4 w-12 bg-slate-700/50 rounded mx-auto"></div>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </div>
        <DialogControlled
          title="New Project"
          description="Choose a project name"
          open={np_action.isOpened}
          onOpenChange={np_action.close}
        >
          <NewProjectForm action={np_action} />
        </DialogControlled>
      </>
    );
  return null;
};

const ProjectsListItem = ({
  project,
}: {
  project: Pick<TApi_Project, 'name' | 'owner_id' | 'project_id'>;
}) => {
  const { data, status } = useQueryUser(project.owner_id);
  return (
    <Table.Row className="border-t border-slate-700 hover:bg-slate-800/50">
      <Table.Cell className="py-4 px-6" style={{ color: 'var(--c-white-1)' }}>
        {project.name}
      </Table.Cell>
      <Table.Cell className="py-4 px-6 ellipsis hidden sm:table-cell">
        {status === 'success' ? (
          <UserInline color="var(--c-white-1)" {...data} />
        ) : (
          '...'
        )}
      </Table.Cell>
      <Table.Cell className="py-4 px-6 text-center">
        <a
          href={`/p/${project.owner_id}/${project.name}/editor`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium -bg--c-alt-blue-1 hover:-bg--c-alt-blue-2 text-white transition-colors"
        >
          Open Project
        </a>
      </Table.Cell>
      <Table.Cell className="py-4 px-6 text-center hidden sm:table-cell">
        <DeleteProjectFormLogic project_id={project.project_id} />
      </Table.Cell>
    </Table.Row>
  );
};
