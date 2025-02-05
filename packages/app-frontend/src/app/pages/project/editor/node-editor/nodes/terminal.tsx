/**
 * WARNING: need:
 * <script id="jupyter-config-data" type="application/json">
 * {
 *   "terminalsAvailable": true
 * }
 * </script>
 */
import { useCallback, useEffect, useRef } from 'react';
import { ServerConnection, TerminalManager } from '@jupyterlab/services';
import { Terminal } from '@jupyterlab/terminal';
import { Widget } from '@lumino/widgets';

import { useNode } from '@monorepo/demiurge-space';
import {
  TNodeTerminal,
  TNodeCommon,
  TServerSettings,
  jupyterlabIsReachable,
} from '@monorepo/demiurge-types';

import {
  useDispatcher,
  useJLsManager,
  useSharedData,
} from '../../../model/collab-model-chunk';
import { NodeTerminal } from '@monorepo/demiurge-ui-components';

//

import '@jupyterlab/terminal/style/index';

//

const newTerminal = async (s: TServerSettings) => {
  const settings = ServerConnection.makeSettings(s);
  const manager = new TerminalManager({
    serverSettings: settings,
  });
  const session = await manager.startNew();
  const widget = new Terminal(session, { autoFit: false, theme: 'dark' });
  return widget;
};

//
//

export const DemiurgeTerminal = ({
  server_name,
  project_server_id,
}: TNodeTerminal) => {
  //
  const server = useSharedData(['projectServers'], (sd) => {
    return sd.projectServers.get(`${project_server_id}`);
  });

  const { jlsManager } = useJLsManager();

  const ref = useRef<HTMLDivElement>(null);
  const yet = useRef<boolean>(false);

  const reachable = server?.type === 'jupyter' && jupyterlabIsReachable(server);

  useEffect(() => {
    if (reachable) {
      if (!yet.current && server) {
        yet.current = true;
        jlsManager.getServerSetting(server).then((ss) => {
          newTerminal(ss).then((terminal) => {
            if (ref.current) Widget.attach(terminal, ref.current);
          });
        });
      }
    }
  }, [server, jlsManager, reachable]);

  return <div ref={ref} className="terminal-container"></div>;
};

//
//

export const TerminalNodeLogic = ({
  id,
  server_name,
  project_server_id,
}: TNodeCommon & TNodeTerminal) => {
  const useNodeValue = useNode();

  const dispatcher = useDispatcher();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'delete-node',
      id,
    });
  }, [dispatcher, id]);

  return (
    <NodeTerminal
      {...useNodeValue}
      server_name={server_name}
      project_server_id={project_server_id}
      onDelete={handleDelete}
      Terminal={DemiurgeTerminal}
    />
  );
};
