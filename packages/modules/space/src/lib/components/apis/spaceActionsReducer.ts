import { TEdge, TGraphNode } from '@monorepo/core';

import {
  TSACloseConnector,
  TSAOpenConnector,
  TSAMoveNode,
  TSpaceActions,
  TSAHighlightFromConnector,
  TSAUnhighlightFromConnector,
  TSAReduceNode,
  TSAExpandNode,
  TSACloseNode,
  TSAOpenNode,
  TSAResizeNode,
} from '../../space-events';
import {
  connectorViewDefault,
  isNodeOpened,
  nodeViewDefaultStatus,
  TGraphView,
} from '../../space-types';

//

export class SpaceActionsReducer {
  public reduce(
    action: TSpaceActions,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    switch (action.type) {
      case 'close-connector':
        this.openCloseConnector(action, gv);
        break;

      case 'open-connector':
        this.openCloseConnector(action, gv);
        break;

      case 'move-node':
        this.moveNode(action, gv, nodes, edges);
        break;

      case 'highlight':
        this.setEdgeHighlight(action, gv, true);
        break;

      case 'unhighlight':
        this.setEdgeHighlight(action, gv, false);
        break;

      case 'reduce-node':
        this.changeNodeMode(action, gv, 'REDUCED');
        break;

      case 'expand-node':
        this.changeNodeMode(action, gv, 'EXPANDED');
        break;

      case 'close-node':
        this.openCloseNode(action, gv, nodes, edges);
        break;

      case 'open-node':
        this.openCloseNode(action, gv, nodes, edges);
        break;

      case 'resize-node':
        this.resizeNode(action, gv, nodes, edges);
        break;

      case 'update-graph-view':
        this.updateGraphview(gv, nodes, edges);
        break;
    }
  }

  //

  private openCloseNode(
    action: TSACloseNode | TSAOpenNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (node) {
      node.status.forceOpened = action.type === 'open-node' ? true : false;
      node.status.forceClosed = action.type === 'open-node' ? false : true;
      this.updateGraphview(gv, nodes, edges);
    }
  }

  //

  private openCloseConnector(
    action: TSACloseConnector | TSAOpenConnector,
    gv: TGraphView
  ) {
    let cs = gv.connectorViews[action.nid];

    if (!cs) {
      cs = [];
    }

    let c = cs.find((c) => c.connectorName === action.connectorName);

    if (!c) {
      c = connectorViewDefault(action.connectorName);
      cs.push(c);
      gv.connectorViews[action.nid] = cs;
    }

    c.isOpened = action.type === 'close-connector' ? false : true;

    this.resolveDrawnEdges(gv);
  }

  //

  private moveNode(
    action: TSAMoveNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (node) {
      node.position = action.position;
      this.updateGraphview(gv, nodes, edges);
    }
  }

  //

  private setEdgeHighlight(
    action: TSAHighlightFromConnector | TSAUnhighlightFromConnector,
    gv: TGraphView,
    highlighted: boolean
  ) {
    gv.graph.edges.forEach((edge) => {
      if (
        (edge.from.node === action.nid &&
          edge.from.connectorName === action.connectorName &&
          (action.pinName === undefined ||
            edge.from.pinName === action.pinName)) ||
        (edge.to.node === action.nid &&
          edge.to.connectorName === action.connectorName &&
          (action.pinName === undefined || edge.to.pinName === action.pinName))
      ) {
        edge.highlighted = highlighted;
      }
    });
  }

  //

  private changeNodeMode(
    action: TSAReduceNode | TSAExpandNode,
    gv: TGraphView,
    mode: 'REDUCED' | 'EXPANDED'
  ) {
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (node) {
      node.status.mode = mode;
    }
  }

  //

  private resizeNode(
    action: TSAResizeNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (node) {
      node.size = action.size;
      this.updateGraphview(gv, nodes, edges);
    }
  }

  //

  private resolveDrawnEdges(gv: TGraphView) {
    const groupId = (
      fromNode: string,
      fromConnector: string,
      toNode: string,
      toConnector: string
    ) => {
      return `${fromNode}::${fromConnector}--${toNode}::${toConnector}`;
    };

    //

    const drawnEdges: TEdge[] = [];
    const edgesGroups: Map<string, TEdge> = new Map();

    // for all edges in the graph extract, add to current view while grouping if necessary
    for (const edge of gv.edges) {
      // if one of the two edge connectors is closed in the current view...
      const sourceConnector = gv.connectorViews[edge.from.node]?.find(
        (c) => c.connectorName === edge.from.connectorName
      );
      const targetConnector = gv.connectorViews[edge.to.node]?.find(
        (c) => c.connectorName === edge.to.connectorName
      );

      if (
        sourceConnector?.isOpened === false ||
        targetConnector?.isOpened === false
      ) {
        // ... then group the edge
        const id = groupId(
          edge.from.node,
          edge.from.connectorName,
          edge.to.node,
          edge.to.connectorName
        );
        let groupEdge = edgesGroups.get(id);

        if (!groupEdge) {
          const newGroupEdge: TEdge = {
            group: { edges: [edge] },
            from: {
              ...edge.from,
              pinName: undefined,
            },
            to: {
              ...edge.to,
              pinName: undefined,
            },
            type: 'grouped_edges',
          };
          edgesGroups.set(id, newGroupEdge);
        } else {
          groupEdge.group?.edges.push(edge);
        }
      } else {
        drawnEdges.push(edge);
      }
    }

    gv.graph.edges = [...drawnEdges, ...Array.from(edgesGroups.values())];

    // update grouped count of all connectors in current view
    for (const [nodeId, connectors] of Object.entries(gv.connectorViews)) {
      for (const c of connectors) {
        const edges = gv.graph.edges.filter(
          (edge) =>
            (edge.from.node === nodeId &&
              edge.from.connectorName === c.connectorName) ||
            (edge.to.node === nodeId &&
              edge.to.connectorName === c.connectorName)
        );
        c.groupedEdgesCount = edges.reduce((prev, eg) => {
          if (eg.group) return prev + eg.group.edges.length;
          else return prev;
        }, 0);
      }
    }
  }

  //
  private updateGraphview(
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    // Build set of nodes to render starting from root nodes
    const nodesToRender = new Set<string>();
    const edgesToRender = new Set<TEdge>();

    /*
    console.log(
      'updateGraphview',
      '\nnodes:\n',
      Array.from(nodes.values())
        .map((n) => n.id)
        .join(',\n'),
      '\nedges:\n',
      edges.map((e) => edgeId(e)).join(',\n')
    );
    */

    // Helper function to traverse graph up to max depth
    const traverseFromNode = (nodeId: string, currentDepth: number) => {
      if (currentDepth > gv.params.maxRank) return;

      const node = gv.nodeViews.find((n) => n.id === nodeId);

      const isOpened = node && isNodeOpened(node?.status);

      const nodeEdges = Array.from(edges).filter((e) => {
        console.log({ nodeId, from: e.from.node, to: e.to.node });
        return e.from.node === nodeId || e.to.node === nodeId;
      });

      nodesToRender.add(nodeId);
      /*
      console.log('###### traverseFromNode', {
        nodeId,
        currentDepth,
        maxRank: gv.params.maxRank,
        isOpened,
        nodeEdges,
      });
      */

      if (isOpened) {
        // Find all edges connected to this node
        nodeEdges.forEach((edge) => {
          if (edge.from.node === nodeId) {
            edgesToRender.add(edge);
            traverseFromNode(edge.to.node, currentDepth + 1);
          }
          if (edge.to.node === nodeId) {
            edgesToRender.add(edge);
            traverseFromNode(edge.from.node, currentDepth + 1);
          }
        });
      }
    };

    //

    // Start traversal from each root node
    nodes.forEach((node) => {
      if (node.root) {
        traverseFromNode(node.id, 0);
      }
    });

    // Update graph edges to only include connected edges within max depth
    gv.edges = Array.from(edgesToRender);

    // Remove nodes that no longer exist in nodes map
    gv.graph.nodes = gv.graph.nodes.filter((node) =>
      nodesToRender.has(node.id)
    );

    // build node views if necessary, then add to graph.nodes
    nodesToRender.forEach((nodeId) => {
      let n = gv.nodeViews.find((n) => n.id === nodeId);
      if (!n) {
        n = {
          id: nodeId,
          position: {
            x: 0,
            y: 0,
          },
          status: nodeViewDefaultStatus(),
        };
        gv.nodeViews.push(n);
      }
      gv.graph.nodes.push(n);
    });

    this.resolveDrawnEdges(gv);
  }

  // end class
}
