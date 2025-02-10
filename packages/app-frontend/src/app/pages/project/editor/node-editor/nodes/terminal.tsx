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

import { useNodeContext } from '@monorepo/space';
import { NodeTerminal, TServerSettings } from '@monorepo/jupyter';

import {
  useDispatcher,
  useJLsManager,
  useSharedData,
} from '../../../model/collab-model-chunk';

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
}: {
  server_name: string;
  project_server_id: number;
}) => {
  //
  const server = useSharedData(['jupyterServers'], (sd) => {
    return sd.jupyterServers.get(`${project_server_id}`);
  });

  const { jlsManager } = useJLsManager();

  const ref = useRef<HTMLDivElement>(null);
  const yet = useRef<boolean>(false);

  const reachable = jupyterlabIsReachable(server);

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
}: {
  id: string;
  server_name: string;
  project_server_id: number;
}) => {
  const useNodeValue = useNodeContext();

  const dispatcher = useDispatcher();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'core:delete-node',
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
