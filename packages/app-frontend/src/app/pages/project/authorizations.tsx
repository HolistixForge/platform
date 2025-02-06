import { AuthorizationsFormLogic } from '../../forms/authorizations';
import { ProjectSidebar } from './sidebar';

//

export const ProjectAuthorizationsPage = () => {
  return (
    <div style={{ margin: '100px 0 0 200px' }}>
      <h1>Edit Project Users Authorizations</h1>
      <AuthorizationsFormLogic />
      <ProjectSidebar active="authorizations" />
    </div>
  );
};
