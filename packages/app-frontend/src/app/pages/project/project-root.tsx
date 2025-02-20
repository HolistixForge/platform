import { Outlet, useParams } from 'react-router-dom';
import { HeaderLogic } from '../../header/header-logic';
import { ProjectContext } from './project-context';
import { GatewayCountdown } from './gateway-countdown';

export const ProjectRoot = () => {
  const { owner, project_name } = useParams();
  if (owner && project_name)
    return (
      <ProjectContext ownerId={owner} projectName={project_name}>
        <HeaderLogic />
        <GatewayCountdown />
        <Outlet />
      </ProjectContext>
    );
  return null;
};
