/**
 * WARNING: need:
 * <script id="jupyter-config-data" type="application/json">
 * {
 *   "terminalsAvailable": true
 * }
 * </script>
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ServerConnection, TerminalManager } from '@jupyterlab/services';
import { Terminal } from '@jupyterlab/terminal';
import { Widget } from '@lumino/widgets';

import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TServer, TServersSharedData } from '@monorepo/servers';
import { TGraphNode } from '@monorepo/core';
import {
  DisableZoomDragPan,
  InputsAndOutputs,
  NodeHeader,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space';

import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useJLsManager } from '../../jupyter-shared-model-front';
import { jupyterlabIsReachable } from '../../ds-backend';
import { TServerSettings } from '../../jupyter-types';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';

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

const connectTerminal = async (
  s: TServerSettings,
  sessionModel: { name: string }
) => {
  // At least in storybook. if we don't preload xterm, the terminal will not load
  // maybe vitejs need to see the dynamic imports,
  // the same dynamic import call from @jupyterlab/terminal/src/widget.ts does not work in firefox
  await Xterm_Loading_Workaround();

  const settings = ServerConnection.makeSettings(s);
  const manager = new TerminalManager({
    serverSettings: settings,
  });
  const session = await manager.connectTo({ model: sessionModel });
  const widget = new Terminal(session, { autoFit: false, theme: 'dark' });
  return widget;
};

//
//

export const JupyterTerminal = ({ terminalId }: { terminalId: string }) => {
  //
  const [isReachable, setIsReachable] = useState<boolean | undefined>(
    undefined
  );

  const terminal = useSharedData<TJupyterSharedData>(['terminals'], (sd) => {
    return sd.terminals.get(terminalId);
  });

  const server: TServer = useSharedData<TServersSharedData>(
    ['projectServers'],
    (sd) => {
      return sd.projectServers.get(`${terminal.project_server_id}`);
    }
  );

  const { jlsManager } = useJLsManager();

  const ref = useRef<HTMLDivElement>(null);
  const yet = useRef<boolean>(false);

  //

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (!isReachable) {
      const checkReachable = () => {
        jupyterlabIsReachable(server).then((isReachable) =>
          setIsReachable(isReachable)
        );
      };

      checkReachable();
      interval = setInterval(checkReachable, 60000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isReachable]);

  //

  useEffect(() => {
    if (isReachable) {
      if (!yet.current && server) {
        yet.current = true;
        jlsManager.getServerSetting(server).then((ss) => {
          connectTerminal(ss, terminal.jupyterTerminalSessionModel).then(
            (terminal) => {
              if (ref.current) Widget.attach(terminal, ref.current);
            }
          );
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

//

export const NodeTerminal = ({ node }: { node: TGraphNode }) => {
  const { terminalId } = node.data! as {
    project_server_id: number;
    terminalId: string;
  };

  const {
    id,
    viewStatus,
    expand,
    reduce,
    isOpened,
    open,
    close,
    selected,
    filterOut,
  } = useNodeContext();

  const dispatcher = useDispatcher<TDemiurgeNotebookEvent>();

  const handleDeleteTerminal = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'jupyter:delete-terminal',
      terminalId,
    });
  }, [dispatcher, terminalId]);

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
    onDelete: handleDeleteTerminal,
    filterOut,
  });

  return (
    <div className={`common-node terminal-node`}>
      <InputsAndOutputs id={id} bottom={false} />
      <NodeHeader
        nodeType="terminal"
        id={id}
        open={open}
        isOpened={isOpened}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan noZoom noDrag>
          <div className="node-wrapper-body terminal">
            <JupyterTerminal terminalId={terminalId} />
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};
