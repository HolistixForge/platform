import { TEdge } from './types/edge';
import {
  TSACloseConnector,
  TSAOpenConnector,
  TSpaceActions,
} from './types/spaceActions';
import { TSpaceState } from './spaceState';

//

export class SpaceActionsReducer {
  public currentView: TSpaceState;

  protected currentGraphExtract: TSpaceState = {
    nodes: [],
    edges: [],
    connectors: new Map(),
  };

  constructor(cuge?: TSpaceState) {
    if (cuge) this.currentGraphExtract = cuge;
    this.currentView = structuredClone(this.currentGraphExtract);
  }

  //

  public reduce(action: TSpaceActions): TSpaceState {
    console.log({ action });

    switch (action.type) {
      case 'close-connector':
        this.openCloseConnector(action);
        break;

      case 'open-connector':
        this.openCloseConnector(action);
        break;
    }

    return /*structuredClone*/ this.currentView;
  }

  //

  private openCloseConnector(action: TSACloseConnector | TSAOpenConnector) {
    const cs = this.currentView.connectors.get(action.nid);
    if (cs) {
      const c = cs.find((c) => c.connectorName === action.connectorName);
      if (c) {
        c.isOpened = action.type === 'close-connector' ? false : true;
        this.resolveDrawnEdges();
      }
    }
  }

  //

  private resolveDrawnEdges() {
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
    for (const edge of this.currentGraphExtract.edges) {
      // if one of the two edge connectors is closed in the current view...
      const sourceConnector = this.currentView.connectors
        .get(edge.from.node)
        ?.find((c) => c.connectorName === edge.from.connectorName);
      const targetConnector = this.currentView.connectors
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

    this.currentView.edges = [
      ...drawnEdges,
      ...Array.from(edgesGroups.values()),
    ];

    // update grouped count of all connectors in current view
    this.currentView.connectors.forEach((connectors, nodeId) => {
      connectors.forEach((c) => {
        const edges = this.currentView.edges.filter(
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
