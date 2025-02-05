import {
  ResourceBar,
  ServerStack,
  ServerCard,
  NewServerForm,
  DialogControlled,
} from '@monorepo/demiurge-ui-components';
import { ProjectSidebar } from '../sidebar';
import { useDispatcher, useSharedData } from '../model/collab-model-chunk';
import { useServerProps } from './node-editor/nodes/server';
import { CSSProperties } from 'react';
import { useNewServerAction } from './node-editor/menus/context-menu-logic';
import { useQueryServerImages } from '@monorepo/demiurge-data';

//

export const ResourcePage = () => {
  const projectServers = useSharedData(
    ['projectServers'],
    (sd) => sd.projectServers,
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
              <ServerCardLogic project_server_id={psid} />
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

//

const ServerCardLogic = ({
  project_server_id,
}: {
  project_server_id: number;
}) => {
  const props = useServerProps(project_server_id);

  if (props)
    return (
      <div style={{ '--node-wrapper-header-height': '-8px' } as CSSProperties}>
        <ServerCard {...props} />
      </div>
    );
};
