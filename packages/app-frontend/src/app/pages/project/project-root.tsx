import { Outlet, useParams } from 'react-router-dom';
import { HeaderLogic } from '../../header/header-logic';
import { Project } from './editor/node-editor/nodes/projects';
import { GatewayCountdown } from './gateway-countdown';

export const ProjectRoot = () => {
  const { owner, project_name } = useParams();
  if (owner && project_name)
    return (
      <Project ownerId={owner} projectName={project_name}>
        <HeaderLogic />
        <GatewayCountdown />
        <Outlet />
      </Project>
    );
  return null;
};
