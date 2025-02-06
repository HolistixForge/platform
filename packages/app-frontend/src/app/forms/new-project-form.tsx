import { useMutationDeleteProject } from '@monorepo/frontend-data';
import { ButtonBase, useAction } from '@monorepo/ui-base';

//

export const DeleteProjectFormLogic = (props: { project_id: string }) => {
  const deleteProject = useMutationDeleteProject(props.project_id);
  const action = useAction(() => deleteProject.mutateAsync(), [deleteProject]);
  return <ButtonBase {...action} text="Delete" className="red" />;
};
