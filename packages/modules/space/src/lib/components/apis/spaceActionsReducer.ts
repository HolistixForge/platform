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

  private getAbsolutePosition(
    position: { x: number; y: number },
    parentId: string | undefined,
    gv: TGraphView
  ) {
    let absolutePosition = { ...position };
    let currentParentId = parentId;

    while (currentParentId) {
      const currentParent = gv.nodeViews.find((n) => n.id === currentParentId);
      if (currentParent?.position) {
        absolutePosition.x += currentParent.position.x;
        absolutePosition.y += currentParent.position.y;
        currentParentId = currentParent.parentId;
      } else {
        break;
      }
    }

    return absolutePosition;
  }

  //

  private moveNode(
    action: TSAMoveNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    // get node view object from id
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (node) {
      // get absolute position of node by traversing up the parentId chain
      const absolutePosition = action.position;

      // get all displayed groups (except the node itself)
      const groups = gv.graph.nodes.filter(
        (n) => n.type === 'group' && n.id !== action.nid
      );

      // make a map of all groups absolute positions and sizes
      const candidatesGroups = new Map<
        string,
        {
          id: string;
          absPosition: { x: number; y: number };
          area: number;
        }
      >();

      groups.forEach((group) => {
        if (!group.position) return;
        const groupAbsolutePos = this.getAbsolutePosition(
          group.position,
          group.parentId,
          gv
        );

        // if node is inside this group, add it to the map
        if (
          group.size &&
          absolutePosition.x >= groupAbsolutePos.x &&
          absolutePosition.x <= groupAbsolutePos.x + group.size.width &&
          absolutePosition.y >= groupAbsolutePos.y &&
          absolutePosition.y <= groupAbsolutePos.y + group.size.height
        ) {
          candidatesGroups.set(group.id, {
            id: group.id,
            absPosition: groupAbsolutePos,
            area: group.size.width * group.size.height,
          });
        }
      });

      // Find the smallest group by area that contains the node
      let targetGroup = undefined;
      if (candidatesGroups.size > 0) {
        // Find the smallest group by area that contains the node
        targetGroup = Array.from(candidatesGroups.values()).reduce(
          (smallest, current) => {
            return current.area < smallest.area ? current : smallest;
          }
        );
      }

      // if the node is within a group, set the node parentId to the group id
      // and set the node position to the relative position to the group
      if (targetGroup) {
        node.parentId = targetGroup.id;
        node.position = {
          x: absolutePosition.x - targetGroup.absPosition.x,
          y: absolutePosition.y - targetGroup.absPosition.y,
        };
      } else {
        // if the node is not within any group, set the node parentId to undefined
        // and set the node position to the absolute position
        delete node.parentId;
        node.position = absolutePosition;
      }

      // update the graphview
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

      const nodeEdges = edges.filter((e) => {
        //console.log({ nodeId, from: e.from.node, to: e.to.node });
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
    gv.graph.nodes = [];

    // build node views if necessary, then add to graph.nodes
    nodesToRender.forEach((nodeId) => {
      let n = gv.nodeViews.find((n) => n.id === nodeId);
      if (!n) {
        n = {
          id: nodeId,
          type: nodes.get(nodeId)?.type || 'unknown',
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
