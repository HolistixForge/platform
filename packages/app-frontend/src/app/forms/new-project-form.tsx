import { useMutationDeleteProject } from '@monorepo/demiurge-data';
import { ButtonBase, useAction } from '@monorepo/demiurge-ui-components';

//

export const DeleteProjectFormLogic = (props: { project_id: string }) => {
  const deleteProject = useMutationDeleteProject(props.project_id);
  const action = useAction(() => deleteProject.mutateAsync(), [deleteProject]);
  return <ButtonBase {...action} text="Delete" className="red" />;
};
