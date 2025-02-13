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
} from '../../space-events';
import { TGraphView } from '../../space-types';

//

export class SpaceActionsReducer {
  public reduce(
    action: TSpaceActions,
    gv: TGraphView,
    nodes: Map<string, TGraphNode>
  ) {
    console.log({ action });

    switch (action.type) {
      case 'close-connector':
        this.openCloseConnector(action, gv);
        break;

      case 'open-connector':
        this.openCloseConnector(action, gv);
        break;

      case 'move-node':
        this.moveNode(action, gv);
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
    }
  }

  //

  private openCloseConnector(
    action: TSACloseConnector | TSAOpenConnector,
    gv: TGraphView
  ) {
    const cs = gv.connectorViews.get(action.nid);
    if (cs) {
      const c = cs.find((c) => c.connectorName === action.connectorName);
      if (c) {
        c.isOpened = action.type === 'close-connector' ? false : true;
        this.resolveDrawnEdges(gv);
      }
    }
  }

  //

  private moveNode(action: TSAMoveNode, gv: TGraphView) {
    const node = gv.graph.nodes.find((n) => n.id === action.nid);
    if (node) {
      node.position = action.position;
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
        console.log('found', edge);
      }
    });
  }

  //

  private changeNodeMode(
    action: TSAReduceNode | TSAExpandNode,
    gv: TGraphView,
    mode: 'REDUCED' | 'EXPANDED'
  ) {
    const node = gv.graph.nodes.find((n) => n.id === action.nid);
    if (node) {
      node.status.mode = mode;
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
      const sourceConnector = gv.connectorViews
        .get(edge.from.node)
        ?.find((c) => c.connectorName === edge.from.connectorName);
      const targetConnector = gv.connectorViews
        .get(edge.to.node)
        ?.find((c) => c.connectorName === edge.to.connectorName);

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
    gv.connectorViews.forEach((connectors, nodeId) => {
      connectors.forEach((c) => {
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
      });
    });
  }

  // end class
}
