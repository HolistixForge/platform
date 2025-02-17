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
import { TServer, TServersSharedData } from '@monorepo/servers';

import { useJLsManager } from '../../jupyter-shared-model';
import { jupyterlabIsReachable } from '../../ds-backend';

import '@jupyterlab/terminal/style/index';

//

const Xterm_Loading_Workaround = async () => {
  //
  function hasWebGLContext(): boolean {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    try {
      return gl instanceof WebGLRenderingContext;
    } catch (error) {
      return false;
    }
  }
  const supportWebGL = hasWebGLContext();
  const [xterm_, fitAddon_, renderer_, weblinksAddon_] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    supportWebGL ? import('@xterm/addon-webgl') : import('@xterm/addon-canvas'),
    import('@xterm/addon-web-links'),
  ]);
  console.log({ xterm_, fitAddon_, renderer_, weblinksAddon_ });
};

//

const newTerminal = async (s: TServerSettings) => {
  // At least in storybook. if we don't preload xterm, the terminal will not load
  // maybe vitejs need to see the dynamic imports,
  // the same dynamic import call from @jupyterlab/terminal/src/widget.ts does not work in firefox
  await Xterm_Loading_Workaround();

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
  project_server_id: number;
}) => {
  //
  const [isReachable, setIsReachable] = useState<boolean | undefined>(
    undefined
  );

  const server: TServer = useSharedData<TServersSharedData>(
    ['projectServers'],
    (sd) => {
      return sd.projectServers.get(`${project_server_id}`);
    }
  );

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

  return (
    <div ref={ref} className="terminal-container">
      {isReachable === undefined
        ? 'Reaching for server...'
        : isReachable
        ? null
        : 'Server is not reachable'}
    </div>
  );
};
