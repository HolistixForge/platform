import { useCallback, useRef, useState } from 'react';

import { FormErrors, useAction, DialogControlled } from '@monorepo/ui-base';
import { MountVolumeForm, MountVolumeFormData } from '@monorepo/ui-views';
import { TDemiurgeNotebookEvent } from '@monorepo/jupyter';
import { TEdge, TEdgeEnd, TPosition } from '@monorepo/core';
import {
  TEventMountVolume,
  TServerEvents,
  NodeServer,
  NodeVolume,
} from '@monorepo/servers';
import { SpaceModule } from '@monorepo/space';
import { NodeChatbox, NodeChatAnchor } from '@monorepo/chats';
import { NodeCell, NodeKernel, NodeTerminal } from '@monorepo/jupyter/frontend';
import { NodeYoutube, NodeTextEditor } from '@monorepo/socials';

import { ContextMenuLogic } from './menus/context-menu-logic';
import { SpaceContextMenu } from './menus/context-menu';
import { NewEdgeContextMenu } from './menus/context-menu-new-edge';
import { useDispatcher, useSharedData } from '../../model/collab-model-chunk';
import { edgeToEvent } from './menus/edge-to-event';

import './node-editor.scss';

//

const nodeTypes = {
  server: NodeServer,
  volume: NodeVolume,
  chat: NodeChatbox,
  'chat-anchor': NodeChatAnchor,
  'jupyter-cell': NodeCell,
  'jupyter-kernel': NodeKernel,
  'jupyter-terminal': NodeTerminal,
  youtube: NodeYoutube,
  'text-editor': NodeTextEditor,
};

//

const s = {
  height: '100%',
  backgroundColor: 'var(--color-background)',
};

/**
 *
 */

const useOpenRadixContextMenu = () => {
  const triggerRef = useRef<HTMLSpanElement>(null);

  const open = (clientPosition: TPosition) => {
    triggerRef.current?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: clientPosition.x,
        clientY: clientPosition.y,
      })
    );
  };

  return { triggerRef, open };
};

/**
 *
 */
export const NodeEditorView = ({ viewId }: { viewId: string }) => {
  const nodes = useSharedData(['nodes'], (sd) => sd.nodes);

  const dispatcher = useDispatcher();

  /** save an imcomplete event while missing data are filled in a form
   *  when a edge is drawn between 2 nodes */
  const partialEvent =
    useRef<Partial<TDemiurgeNotebookEvent | TServerEvents>>();

  /** right click coordinates */
  const rcc = useRef<TPosition>({ x: 0, y: 0 });

  /** new edge's origin handle */
  const [from, setFrom] = useState<TEdgeEnd | undefined>(undefined);

  const { triggerRef: trPane, open: openMenu1 } = useOpenRadixContextMenu();

  const { triggerRef: trNewEdge, open: openMenu2 } = useOpenRadixContextMenu();

  /**
   * capture the pointer coordinates in the canvas when user right click
   */
  const handleContextMenu = useCallback(
    (xy: TPosition, clientPosition: TPosition) => {
      rcc.current = xy;
      setFrom(undefined);
      openMenu1(clientPosition);
    },
    [openMenu1]
  );

  /**
   * callback when user draw an edge and end not to another connector.
   * Open a menu to propose creation of a new node.
   */
  const handleNewEdgeToNewNode = useCallback(
    (from: TEdgeEnd, xy: TPosition, clientPosition: TPosition) => {
      rcc.current = xy;
      setFrom(from);
      openMenu2(clientPosition);
    },
    [openMenu2]
  );

  /**
   *
   * strange usage of useAction to popup errors
   *
   */

  const error_action = useAction<Error>(async (e) => {
    throw e;
  }, []);

  /**
   *
   * mount volume
   *
   */

  const vm_action = useAction<MountVolumeFormData>(
    (d) => {
      return dispatcher.dispatch({
        ...(partialEvent.current as TEventMountVolume),
        mount_point: d.mount_point as string,
      });
    },
    [dispatcher],
    {
      checkForm: (d, e) => {
        if (!d.mount_point) e.mount_point = 'Please choose a mount point';
      },
    }
  );

  /**
   * callback when user draw an edge between two existing nodes.
   * convert into the revelant event and open a form if necessary
   * to complete data.
   */
  const handleConnect = (edge: TEdge) => {
    try {
      const event = edgeToEvent(edge, nodes);
      if (event.type === 'servers:mount-volume') {
        partialEvent.current = event;
        vm_action.open();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      error_action.callback(error);
      error_action.open();
    }
  };

  return (
    <div style={s}>
      <SpaceModule
        viewId={viewId}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onContextMenu={handleContextMenu}
        onContextMenuNewEdge={handleNewEdgeToNewNode}
      />
      <ContextMenuLogic refCoordinates={rcc} viewId={viewId} from={from}>
        <SpaceContextMenu triggerRef={trPane} />
        <NewEdgeContextMenu triggerRef={trNewEdge} />
      </ContextMenuLogic>

      <DialogControlled
        title="Mount Volume"
        description="Choose a mount point"
        open={vm_action.isOpened}
        onOpenChange={vm_action.close}
      >
        <MountVolumeForm action={vm_action} />
      </DialogControlled>

      <DialogControlled
        title="Error"
        description=""
        open={error_action.isOpened}
        onOpenChange={error_action.close}
      >
        <FormErrors errors={error_action.errors} />
      </DialogControlled>
    </div>
  );
};
