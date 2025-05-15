import { CSSProperties, useCallback } from 'react';

import {
  NodeHeader,
  DisableZoomDragPan,
  TNodeContext,
  useMakeButton,
  useNodeContext,
  InputsAndOutputs,
} from '@monorepo/space/frontend';
import { TGraphNode } from '@monorepo/core';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import {
  useApi,
  useCurrentUser,
  useQueryServerImages,
  useQueryUser,
} from '@monorepo/frontend-data';
import { TTabEvents } from '@monorepo/tabs';

import { ServerCardInternal } from '../server-card';
import {
  TServerComponentProps,
  TServerComponentCallbacks,
  TServer,
  TSSS_Server_to_TServerComponentProps,
} from '../../servers-types';
import { TServersSharedData } from '../../servers-shared-model';
import { TServerEvents } from '../../servers-events';

//

export const useServerProps = (
  project_server_id: number
): (TServerComponentProps & TServerComponentCallbacks) | undefined => {
  //

  const server: TServer = useSharedData<TServersSharedData>(
    ['projectServers'],
    (sd) => {
      return sd.projectServers.get(`${project_server_id}`);
    }
  );

  const { data: currentUserData } = useCurrentUser();

  const { data: imageData } = useQueryServerImages();

  const { data: hostData } = useQueryUser(server?.host_user_id || null);

  const dispatcher = useDispatcher<TServerEvents | TTabEvents<any>>();

  const { ganymedeApi } = useApi();

  //

  const onHost = useCallback(async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'servers:host',
        project_server_id: server.project_server_id,
      });
  }, [dispatcher, server]);

  //

  const onCopyCommand = async () => {
    const r = await (ganymedeApi.fetch({
      url: 'projects/{project_id}/server/{project_server_id}/cmd',
      method: 'GET',
      pathParameters: {
        project_id: server.project_id,
        project_server_id,
      },
    }) as Promise<{ command: string }>);
    return r.command;
  };

  //

  const onCloud = useCallback(
    async (instanceType: string, storage: number) => {
      if (server)
        await dispatcher.dispatch({
          type: 'servers:to-cloud',
          project_server_id: server.project_server_id,
          instanceType,
          storage,
        });
    },
    [dispatcher, server]
  );

  //

  const onCloudStart = async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'servers:cloud-start',
        project_server_id: server.project_server_id,
      });
  };

  //

  const onCloudStop = async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'servers:cloud-pause',
        project_server_id: server.project_server_id,
      });
  };

  //

  const onCloudDelete = useCallback(async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'servers:cloud-delete',
        project_server_id: server.project_server_id,
      });
  }, [dispatcher, server]);

  //

  const onDelete = useCallback(async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'servers:delete',
        project_server_id: server.project_server_id,
        client_id: server.oauth[0].client_id,
      });
  }, [dispatcher, server]);

  //

  const onOpenService = useCallback(
    async (name: string) => {
      if (server) {
        const service = server.httpServices.find((svc) => svc.name === name);
        if (service) {
          await dispatcher.dispatch({
            type: 'tabs:add-tab',
            path: [],
            title: `${server.server_name}:${service.name}`,
            payload: {
              type: 'resource-ui',
              project_server_id: server.project_server_id,
              service_name: name,
            },
          });
        }
      }
    },
    [dispatcher, server]
  );

  //
  if (server)
    return {
      onHost,
      onCopyCommand:
        // define onCopyCommand only if user is the host, so that other users do not have the ebutton displayed
        hostData?.user_id !== undefined &&
        currentUserData?.user.user_id === hostData?.user_id
          ? onCopyCommand
          : undefined,
      //
      onCloud,
      onCloudStart,
      onCloudStop,
      onCloudDelete,
      //
      onDelete,
      onOpenService,

      //
      ...TSSS_Server_to_TServerComponentProps(server, hostData, imageData?._0),
    };

  return undefined;
};

//

export const NodeServer = ({ node }: { node: TGraphNode }) => {
  const project_server_id = node.data!.project_server_id as number;

  const useNodeValue = useNodeContext();

  const props = useServerProps(project_server_id);

  if (props) return <NodeServerInternal {...useNodeValue} {...props} />;

  return null;
};

/**
 *
 */

export const NodeServerInternal = (
  props: TServerComponentProps &
    TServerComponentCallbacks &
    Pick<
      TNodeContext,
      | 'id'
      | 'isOpened'
      | 'open'
      | 'close'
      | 'viewStatus'
      | 'expand'
      | 'reduce'
      | 'filterOut'
      | 'selected'
    >
) => {
  //

  const {
    id,
    isOpened,
    open,
    close,
    viewStatus,
    expand,
    reduce,
    filterOut,
    selected,
    onDelete,
    ...otherProps
  } = props;

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    onDelete,
    isOpened,
    filterOut,
  });

  return (
    <div
      className={`common-node server-node`}
      style={{ '--node-wrapper-header-height': '78px' } as CSSProperties}
    >
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="server"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan noDrag>
          <div className="node-wrapper-body server">
            <ServerCardInternal {...otherProps} onDelete={onDelete} />
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};
