import {
  useApi,
  useCurrentUser,
  useQueryServerImages,
  useQueryUser,
} from '@monorepo/demiurge-data';
import {
  useDispatcher,
  useSharedData,
} from '../../../model/collab-model-chunk';
import {
  TJupyterServerInfo,
  TNodeCommon,
  TNodeServer,
  TServerComponentCallbacks,
  TServerComponentProps,
  TSSS_Server_to_TServerComponentProps,
} from '@monorepo/demiurge-types';
import { useNode } from '@monorepo/demiurge-space';
import { useCallback } from 'react';
import { NodeServer } from '@monorepo/demiurge-ui-components';
import { useProject } from './projects';

/**
 *
 *
 *
 */

//

export const useServerProps = (
  project_server_id: number | string,
): (TServerComponentProps & TServerComponentCallbacks) | undefined => {
  //

  const server = useSharedData(['projectServers'], (sd) => {
    return sd.projectServers.get(`${project_server_id}`);
  }) as TJupyterServerInfo | undefined;

  const { data: currentUserData, status: currentUserStatus } = useCurrentUser();

  const { status: imageStatus, data: imageData } = useQueryServerImages();

  const { data: hostData, status: hostStatus } = useQueryUser(
    server?.host_user_id || null,
  );

  const dispatcher = useDispatcher();

  const { gatewayFQDN, project } = useProject();

  const { ganymedeApi } = useApi();

  //

  const onHost = useCallback(async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'host-server',
        project_server_id: server.project_server_id,
      });
  }, [dispatcher, server]);

  //

  const onCopyCommand = async () => {
    const r = await (ganymedeApi.fetch({
      url: 'projects/{project_id}/server/{project_server_id}/cmd',
      method: 'GET',
      pathParameters: {
        project_id: project.project_id,
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
          type: 'server-to-cloud',
          project_server_id: server.project_server_id,
          instanceType,
          storage,
        });
    },
    [dispatcher, server],
  );

  //

  const onCloudStart = async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'server-cloud-start',
        project_server_id: server.project_server_id,
      });
  };

  //

  const onCloudStop = async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'server-cloud-pause',
        project_server_id: server.project_server_id,
      });
  };

  //

  const onCloudDelete = useCallback(async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'server-cloud-delete',
        project_server_id: server.project_server_id,
      });
  }, [dispatcher, server]);

  //

  const onDelete = useCallback(async () => {
    if (server)
      await dispatcher.dispatch({
        type: 'delete-server',
        project_server_id: server.project_server_id,
      });
  }, [dispatcher, server]);

  //

  const onOpenService = useCallback(
    async (name: string) => {
      if (server) {
        const service = server.httpServices.find((svc) => svc.name === name);
        if (service) {
          await dispatcher.dispatch({
            type: 'add-tab',
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
    [dispatcher, server],
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
      ...TSSS_Server_to_TServerComponentProps(
        server,
        gatewayFQDN,
        hostData,
        imageData?._0,
      ),
    };
};

//

export const ServerNodeLogic = ({
  project_server_id,
}: TNodeCommon & TNodeServer) => {
  const useNodeValue = useNode();

  const props = useServerProps(project_server_id);
  if (props) return <NodeServer {...useNodeValue} {...props} />;
};
