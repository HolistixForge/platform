import { FC } from 'react';

import {
  EmbeddedNodeContext,
  TWhiteboardFrontendExports,
  useWhiteboardMode,
} from '@holistix-forge/whiteboard/frontend';
import { TWhiteboardSharedData, TNodeView } from '@holistix-forge/whiteboard';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { TCoreSharedData, TGraphNode } from '@holistix-forge/core-graph';
import { useModuleExports } from '@holistix-forge/module/frontend';

//

/**
 * Node types that are a drawing rather than a thing.
 *
 * A shape has nothing running behind it — no process, no document, no remote
 * call. Clicking one means "I want to move this", never "I want to use this",
 * so it keeps Excalidraw's own behaviour: click selects, drag moves, and the
 * shape's own toolbar is still there behind the usual click into its centre.
 *
 * Everything else — a notebook, a terminal, an editor, a chat — is live, and
 * is treated as live. Groups are drawn as frames rather than embeds, so they
 * never reach this; named anyway, because that could change and the answer
 * for a group would be the same.
 */
const VISUAL_NODE_TYPES = new Set(['shape', 'group']);

/**
 * Who gets the click: the node, or the canvas underneath it.
 *
 * Excalidraw gates every embed behind an "Interact" click — `pointer-events`
 * stays off until you click the middle third of the element. That is right for
 * an embedded web page you might want to drag around, and wrong for a node
 * whose whole purpose is to be used: it put a click between the user and every
 * button on every card.
 *
 * So the gate is removed for live nodes, and the board's existing move mode
 * takes over the job it was already doing on the ReactFlow canvas — while it
 * is on, the node stops taking the pointer and the click reaches Excalidraw,
 * which selects and drags the element like any other. One mode, one meaning,
 * on both surfaces.
 *
 * `undefined` is not the same as `'none'`: it leaves Excalidraw's gate in
 * place, which is what a purely visual node wants. `'none'` overrides a gate
 * that is already open, which is what a live node needs in move mode.
 */
export const nodePointerEvents = (
  nodeType: string,
  mode: string
): 'auto' | 'none' | undefined => {
  if (VISUAL_NODE_TYPES.has(nodeType)) return undefined;
  return mode === 'move-node' ? 'none' : 'auto';
};

//

/**
 * A Holistix node, rendered inside the Excalidraw scene.
 *
 * The element in the scene carries nothing but the node's id: the node itself
 * stays in the graph, which is what keeps one node from having two homes. This
 * reads it back and hands it to the component the whiteboard registered for
 * its type — the same component ReactFlow renders, in the same context, minus
 * the chrome that belongs to the canvas rather than to the node.
 */
export const EmbeddedNode: FC<{ nodeId: string; viewId: string }> = ({
  nodeId,
  viewId,
}) => {
  const { whiteboard } = useModuleExports<{
    whiteboard: TWhiteboardFrontendExports;
  }>('whiteboard');

  const node = useLocalSharedData<TCoreSharedData>(['core-graph:nodes'], (sd) =>
    sd['core-graph:nodes'].get(nodeId)
  ) as TGraphNode<never> | undefined;

  const mode = useWhiteboardMode();

  const nodeView = useLocalSharedData<TWhiteboardSharedData>(
    ['whiteboard:graphViews'],
    (sd) =>
      sd['whiteboard:graphViews']
        ?.get(viewId)
        ?.nodeViews?.find((nv: TNodeView) => nv.id === nodeId)
  ) as TNodeView | undefined;

  // Returning null here is not neutral: Excalidraw falls back to an <iframe>
  // pointing at the sentinel URL, which resolves nowhere — so a node that
  // fails to resolve looks exactly like an empty box. Each branch says which
  // one it was instead.
  const fail = (why: string) => (
    <div
      data-testid="embedded-node-error"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#2a1020',
        color: '#ff8fa3',
        border: '1px dashed #ff8fa3',
        borderRadius: 6,
        fontSize: 12,
        fontFamily: 'ui-monospace, monospace',
        textAlign: 'center',
        padding: 8,
      }}
    >
      {why}
    </div>
  );

  if (!node) return fail(`no node ${nodeId.slice(0, 12)}`);
  if (!nodeView) return fail(`no nodeView ${nodeId.slice(0, 12)}`);

  const NodeComponent = whiteboard.uiElements.nodes[node.type];
  if (!NodeComponent) return fail(`type not registered: ${node.type}`);

  return (
    <EmbeddedNodeContext
      id={nodeId}
      viewId={viewId}
      // Excalidraw scales the embed container itself, so the node is laid out
      // at 1:1 inside it. A node that reads the zoom to size its own chrome
      // would otherwise scale twice.
      zoom={1}
      status={nodeView.status}
    >
      <div
        data-testid="embedded-node"
        data-node-type={node.type}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: nodePointerEvents(node.type, mode),
        }}
      >
        <NodeComponent node={node} />
      </div>
    </EmbeddedNodeContext>
  );
};
