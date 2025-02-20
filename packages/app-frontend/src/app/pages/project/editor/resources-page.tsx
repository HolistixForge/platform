import { useQueryServerImages } from '@monorepo/frontend-data';
import { DialogControlled } from '@monorepo/ui-base';
import { ResourceBar, ServerStack, NewServerForm } from '@monorepo/ui-views';
import { ServerCard } from '@monorepo/servers';

import { ProjectSidebar } from '../sidebar';
import { useDispatcher, useSharedData } from '../model/collab-model-chunk';
import { useNewServerAction } from './node-editor/menus/context-menu-logic';

//

export const ResourcePage = () => {
  const projectServers = useSharedData(
    ['projectServers'],
    (sd) => sd.projectServers
  );

  const dispatcher = useDispatcher();

  const s_action = useNewServerAction(dispatcher);

  const { status, data } = useQueryServerImages();

  const array: number[] = [];

  projectServers.forEach((p) => array.push(p.project_server_id));

  return (
    <>
      <div
        style={{
          height: '100%',
          position: 'relative',
          maxHeight: 'calc(100vh - 76px)',
          overflowY: 'auto',
        }}
      >
        <ResourceBar title="Resources" />
        <div className="p-24">
          <ServerStack onNewServerClick={() => s_action.open()}>
            {array.map((psid) => (
              <ServerCard project_server_id={psid} />
            ))}
          </ServerStack>
        </div>{' '}
      </div>
      <ProjectSidebar active="project-main" />

      <DialogControlled
        title="New server"
        description="Choose a name and select an image for your new server."
        open={s_action.isOpened}
        onOpenChange={s_action.close}
      >
        <NewServerForm
          images={status === 'success' ? data._0 : undefined}
          action={s_action}
        />
      </DialogControlled>
    </>
  );
};
