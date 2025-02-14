/**
 * WARNING: need:
 * <script id="jupyter-config-data" type="application/json">
 * {
 *   "terminalsAvailable": true
 * }
 * </script>
 */

import { useEffect, useRef, useState } from 'react';
import { ServerConnection, TerminalManager } from '@jupyterlab/services';
import { Terminal } from '@jupyterlab/terminal';
import { Widget } from '@lumino/widgets';

import { TServerSettings } from '@monorepo/jupyter';
import { useSharedData } from '@monorepo/collab-engine';

import { TJupyterSharedData, useJLsManager } from '../../jupyter-shared-model';
import { jupyterlabIsReachable } from '../../ds-backend';

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

export const JupyterTerminal = ({
  project_server_id,
}: {
  server_name: string;
  project_server_id: number;
}) => {
  //
  const [isReachable, setIsReachable] = useState(false);

  const server = useSharedData<TJupyterSharedData>(['jupyterServers'], (sd) => {
    return sd.jupyterServers.get(`${project_server_id}`);
  });

  const { jlsManager } = useJLsManager();

  const ref = useRef<HTMLDivElement>(null);
  const yet = useRef<boolean>(false);

  jupyterlabIsReachable(server).then((isReachable) =>
    setIsReachable(isReachable)
  );

  useEffect(() => {
    if (isReachable) {
      if (!yet.current && server) {
        yet.current = true;
        jlsManager.getServerSetting(server).then((ss) => {
          newTerminal(ss).then((terminal) => {
            if (ref.current) Widget.attach(terminal, ref.current);
          });
        });
      }
    }
  }, [server, jlsManager, isReachable]);

  return <div ref={ref} className="terminal-container"></div>;
};
