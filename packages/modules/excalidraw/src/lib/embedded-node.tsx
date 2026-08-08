import { FC } from 'react';

import {
  EmbeddedNodeContext,
  TWhiteboardFrontendExports,
} from '@holistix-forge/whiteboard/frontend';
import { TWhiteboardSharedData, TNodeView } from '@holistix-forge/whiteboard';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { TCoreSharedData, TGraphNode } from '@holistix-forge/core-graph';
import { useModuleExports } from '@holistix-forge/module/frontend';

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
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <NodeComponent node={node} />
      </div>
    </EmbeddedNodeContext>
  );
};
