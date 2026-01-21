import { Outlet } from 'react-router-dom';
import { HeaderLogicProject } from '../../header/header-logic';
import { ProjectWrapper } from './project-wrapper';
import { ProjectCountdown } from './gateway-countdown';

/**
 * ProjectRoot - Entry point for project pages
 * 
 * Pure UI component that uses ProjectWrapper from frontend-data
 * for all data infrastructure.
 */
export const ProjectRoot = () => {
  return (
    <ProjectWrapper>
      <HeaderLogicProject />
      <ProjectCountdown />
      <Outlet />
    </ProjectWrapper>
  );
};
