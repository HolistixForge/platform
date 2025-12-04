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
import { MessageLoop } from '@lumino/messaging';

import { useLocalSharedData } from '@holistix/collab/frontend';
import { useDispatcher } from '@holistix/reducers/frontend';
import {
  TUserContainer,
  TUserContainersSharedData,
} from '@holistix/user-containers';
import { TGraphNode } from '@holistix/core-graph';
import {
  DisableZoomDragPan,
  InputsAndOutputs,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix/space/frontend';

import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useJLsManager } from '../../jupyter-hooks';
import { jupyterlabIsReachable } from '../../ds-backend';
import {
  TUserContainerSettings,
  TTerminalNodeDataPayload,
  Terminal as MyTerminal,
} from '../../jupyter-types';
import { TJupyterEvent } from '../../jupyter-events';

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      return false;
    }
  }
  const supportWebGL = hasWebGLContext();
  /* const [xterm_, fitAddon_, renderer_, weblinksAddon_] = */ await Promise.all(
    [
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      supportWebGL
        ? import('@xterm/addon-webgl')
        : import('@xterm/addon-canvas'),
      import('@xterm/addon-web-links'),
    ]
  );
  // console.log({ xterm_, fitAddon_, renderer_, weblinksAddon_ });
};

//

const connectTerminal = async (
  s: TUserContainerSettings,
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
  const widget = new Terminal(session, { autoFit: true, theme: 'dark' });
  return widget;
};

//
//

export const JupyterTerminal = ({
  terminalId,
  userContainerId,
}: {
  terminalId: string;
  userContainerId: string;
}) => {
  //
  const [isReachable, setIsReachable] = useState<boolean | undefined>(
    undefined
  );

  const terminal: MyTerminal = useLocalSharedData<TJupyterSharedData>(
    ['jupyter:servers'],
    (sd) => {
      return sd['jupyter:servers'].get(`${userContainerId}`)?.terminals[
        terminalId
      ];
    }
  );

  const server: TUserContainer = useLocalSharedData<TUserContainersSharedData>(
    ['user-containers:containers'],
    (sd) => {
      return sd['user-containers:containers'].get(`${userContainerId}`);
    }
  );

  const jlsManager = useJLsManager();

  const ref = useRef<HTMLDivElement>(null);
  const terminalWidgetRef = useRef<Terminal | null>(null); // Store the Terminal widget instance

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
  }, [isReachable, server]);

  //

  useEffect(() => {
    if (isReachable) {
      if (server) {
        jlsManager.getServerSetting(server).then((ss) => {
          connectTerminal(ss, terminal.sessionModel).then((terminalWidget) => {
            if (terminalWidgetRef.current) {
              terminalWidgetRef.current.dispose();
            }
            terminalWidgetRef.current = terminalWidget;
            terminalWidget.node.style.width = '100%';
            terminalWidget.node.style.height = '100%';
            if (ref.current) Widget.attach(terminalWidget, ref.current);
          });
        });
      }
    }
  }, [server, jlsManager, terminalId, isReachable, terminal.sessionModel]);

  // ResizeObserver to auto-fit terminal on container resize
  useEffect(() => {
    if (!ref.current) return;
    const observer = new window.ResizeObserver(() => {
      if (terminalWidgetRef.current) {
        MessageLoop.sendMessage(
          terminalWidgetRef.current,
          Widget.Msg.FitRequest
        );
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="terminal-container"
      style={{ width: '100%', height: '100%' }}
    >
      {isReachable === undefined
        ? 'Reaching for server...'
        : isReachable
        ? null
        : 'Server is not reachable, will try again in 60 seconds'}
    </div>
  );
};

//

export const NodeTerminal = ({
  node,
}: {
  node: TGraphNode<TTerminalNodeDataPayload>;
}) => {
  const { terminal_id, user_container_id } =
    node.data as TTerminalNodeDataPayload;

  const { id, isOpened, open, selected } = useNodeContext();

  const dispatcher = useDispatcher<TJupyterEvent>();

  const handleDeleteTerminal = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'jupyter:delete-terminal-node',
      nodeId: id,
    });
  }, [dispatcher, id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDeleteTerminal,
  });

  return (
    <div className={`common-node terminal-node node-resizable`}>
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
        <DisableZoomDragPan noZoom noDrag fullHeight>
          <div
            className="node-wrapper-body terminal"
            style={{ height: '100%' }}
          >
            <JupyterTerminal
              terminalId={terminal_id}
              userContainerId={user_container_id}
            />
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};
