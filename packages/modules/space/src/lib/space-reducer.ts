import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import {
  TCoreEvent,
  TCoreSharedData,
  TEdge,
  TEventNewNode,
  TGraphNode,
} from '@monorepo/core';
import { error } from '@monorepo/log';

import { TSpaceSharedData } from './space-shared-model';
import {
  TSpaceEvent,
  TEventNewView,
  TEventNewGroup,
  TEventGroupPropertyChange,
  TEventShapePropertyChange,
  TEventNewShape,
  TEventDeleteShape,
  TEventDeleteGroup,
  TEventMoveNode,
  TEventReduceNode,
  TEventExpandNode,
  TEventCloseConnector,
  TEventOpenConnector,
  TEventHighlightFromConnector,
  TEventUnhighlightFromConnector,
  TEventResizeNode,
  TEventFilterOutNode,
  TEventUnfilterOutNode,
  TEventOpenNode,
  TEventCloseNode,
  TEventUpdateGraphView,
} from './space-events';
import {
  defaultGraphView,
  nodeViewDefaultStatus,
  TGraphView,
  connectorViewDefault,
  isNodeOpened,
} from './space-types';
import { getAbsolutePosition } from './utils/position-utils';

/**
 *
 */

type ReducedEvents = TSpaceEvent | TCoreEvent;

type Ra<T> = ReduceArgs<
  TSpaceSharedData & TCoreSharedData,
  T,
  ReducedEvents,
  undefined
>;

/**
 *
 */

export class SpaceReducer extends Reducer<
  TSpaceSharedData & TCoreSharedData,
  ReducedEvents,
  TSpaceEvent,
  undefined
> {
  private executeGraphViewAction<T extends { viewId: string }>(
    g: Ra<T>,
    action: (
      gvc: TGraphView,
      nodes: Map<string, TGraphNode>,
      edges: TEdge[]
    ) => void
  ): Promise<void> {
    const viewId = g.event.viewId;
    const gv = g.sd.graphViews.get(viewId);
    if (!gv) {
      error('SPACE', `Graph view ${viewId} not found`);
      return Promise.resolve();
    }

    const gvc = structuredClone(gv);
    const nodes = g.sd.nodes as unknown as Map<string, TGraphNode>;
    const edges = g.sd.edges as unknown as TEdge[];

    action(gvc, nodes, edges);
    g.sd.graphViews.set(viewId, gvc);
    return Promise.resolve();
  }

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'space:new-view':
        return this.newView(g as Ra<TEventNewView>);

      case 'space:move-node':
        return this.executeGraphViewAction(
          g as Ra<TEventMoveNode>,
          (gvc, nodes, edges) => {
            this.moveNode(g.event as TEventMoveNode, gvc, nodes, edges);
          }
        );

      case 'space:reduce-node':
        return this.executeGraphViewAction(g as Ra<TEventReduceNode>, (gvc) => {
          this.changeNodeMode(g.event as TEventReduceNode, gvc, 'REDUCED');
        });

      case 'space:expand-node':
        return this.executeGraphViewAction(g as Ra<TEventExpandNode>, (gvc) => {
          this.changeNodeMode(g.event as TEventExpandNode, gvc, 'EXPANDED');
        });

      case 'space:close-connector':
      case 'space:open-connector':
        return this.executeGraphViewAction(
          g as Ra<TEventCloseConnector | TEventOpenConnector>,
          (gvc) => {
            this.openCloseConnector(
              g.event as TEventCloseConnector | TEventOpenConnector,
              gvc
            );
          }
        );

      case 'space:highlight':
        return this.executeGraphViewAction(
          g as Ra<TEventHighlightFromConnector>,
          (gvc) => {
            this.setEdgeHighlight(
              g.event as TEventHighlightFromConnector,
              gvc,
              true
            );
          }
        );

      case 'space:unhighlight':
        return this.executeGraphViewAction(
          g as Ra<TEventUnhighlightFromConnector>,
          (gvc) => {
            this.setEdgeHighlight(
              g.event as TEventUnhighlightFromConnector,
              gvc,
              false
            );
          }
        );

      case 'space:filter-out-node':
        return this.executeGraphViewAction(
          g as Ra<TEventFilterOutNode>,
          (gvc, nodes, edges) => {
            this.filterOutNode(
              g.event as TEventFilterOutNode,
              gvc,
              nodes,
              edges
            );
          }
        );

      case 'space:unfilter-out-node':
        return this.executeGraphViewAction(
          g as Ra<TEventUnfilterOutNode>,
          (gvc, nodes, edges) => {
            this.unfilterOutNode(
              g.event as TEventUnfilterOutNode,
              gvc,
              nodes,
              edges
            );
          }
        );

      case 'space:open-node':
      case 'space:close-node':
        return this.executeGraphViewAction(
          g as Ra<TEventOpenNode | TEventCloseNode>,
          (gvc, nodes, edges) => {
            this.openCloseNode(
              g.event as TEventOpenNode | TEventCloseNode,
              gvc,
              nodes,
              edges
            );
          }
        );

      case 'space:resize-node':
        return this.executeGraphViewAction(
          g as Ra<TEventResizeNode>,
          (gvc, nodes, edges) => {
            this.resizeNode(g.event as TEventResizeNode, gvc, nodes, edges);
          }
        );

      case 'space:update-graph-view':
        return this.executeGraphViewAction(
          g as Ra<TEventUpdateGraphView>,
          (gvc, nodes, edges) => {
            this.updateGraphview(gvc, nodes, edges);
          }
        );

      case 'space:new-group':
        this.newGroup(g as Ra<TEventNewGroup>);
        return Promise.resolve();

      case 'space:new-shape':
        this.newShape(g as Ra<TEventNewShape>);
        return Promise.resolve();

      case 'space:group-property-change':
        this.groupPropertyChange(g as Ra<TEventGroupPropertyChange>);
        return Promise.resolve();

      case 'space:shape-property-change':
        this.shapePropertyChange(g as Ra<TEventShapePropertyChange>);
        return Promise.resolve();

      case 'space:delete-shape':
        this.deleteShape(g as Ra<TEventDeleteShape>);
        return Promise.resolve();

      case 'space:delete-group':
        this.deleteGroup(g as Ra<TEventDeleteGroup>);
        return Promise.resolve();

      case 'core:delete-edge':
      case 'core:delete-node':
      case 'core:new-edge':
        this.updateAllGraphviews(g);
        return Promise.resolve();

      case 'core:new-node':
        this.newNode(g as Ra<TEventNewNode>);
        this.updateAllGraphviews(g);
        return Promise.resolve();

      default:
        return Promise.resolve();
    }
  }

  private openCloseNode(
    action: TEventCloseNode | TEventOpenNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (!node) {
      error('SPACE', `Node ${action.nid} not found in graph view`);
      return;
    }

    node.status.forceOpened = action.type === 'space:open-node';
    node.status.forceClosed = action.type === 'space:open-node' ? false : true;
    this.updateGraphview(gv, nodes, edges);
  }

  private unfilterOutNode(
    action: TEventUnfilterOutNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    if (!gv.params.filterOutNodes) gv.params.filterOutNodes = [];
    gv.params.filterOutNodes = gv.params.filterOutNodes.filter(
      (nid) => nid !== action.nid
    );
    this.updateGraphview(gv, nodes, edges);
  }

  private filterOutNode(
    action: TEventFilterOutNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    if (!gv.params.filterOutNodes) gv.params.filterOutNodes = [];
    gv.params.filterOutNodes.push(action.nid);
    this.updateGraphview(gv, nodes, edges);
  }

  private getConnectorView(
    gv: TGraphView,
    nodeId: string,
    connectorName: string
  ) {
    let cs = gv.connectorViews[nodeId];
    if (!cs) {
      cs = [];
      gv.connectorViews[nodeId] = cs;
    }
    let c = cs.find((c) => c.connectorName === connectorName);
    if (!c) {
      c = connectorViewDefault(connectorName);
      cs.push(c);
    }
    return c;
  }

  private openCloseConnector(
    action: TEventCloseConnector | TEventOpenConnector,
    gv: TGraphView
  ) {
    const c = this.getConnectorView(gv, action.nid, action.connectorName);
    c.isOpened = action.type === 'space:close-connector' ? false : true;
    this.resolveDrawnEdges(gv);
  }

  private getChildren(nid: string, gv: TGraphView, childs: Set<string>) {
    for (const node of gv.nodeViews) {
      if (node.parentId === nid) {
        childs.add(node.id);
        this.getChildren(node.id, gv, childs);
      }
    }
    return childs;
  }

  private moveNode(
    action: TEventMoveNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (!node) {
      error('SPACE', `Node ${action.nid} not found in graph view`);
      return;
    }

    const absolutePosition = getAbsolutePosition(
      action.position,
      node.parentId,
      gv
    );

    if (!action.stop) {
      delete node.parentId;
      node.position = absolutePosition;
    } else {
      const groups = gv.graph.nodes.filter(
        (n) => n.type === 'group' && n.id !== action.nid
      );

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
        const groupAbsolutePos = getAbsolutePosition(
          group.position,
          group.parentId,
          gv
        );

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

      const childs = new Set<string>();
      this.getChildren(action.nid, gv, childs);
      childs.forEach((c) => {
        candidatesGroups.delete(c);
      });

      let targetGroup = undefined;
      if (candidatesGroups.size > 0) {
        targetGroup = Array.from(candidatesGroups.values()).reduce(
          (smallest, current) => {
            return current.area < smallest.area ? current : smallest;
          }
        );
      }

      if (targetGroup) {
        node.parentId = targetGroup.id;
        node.position = {
          x: absolutePosition.x - targetGroup.absPosition.x,
          y: absolutePosition.y - targetGroup.absPosition.y,
        };
      } else {
        delete node.parentId;
        node.position = absolutePosition;
      }
    }

    this.updateGraphview(gv, nodes, edges);
  }

  private setEdgeHighlight(
    action: TEventHighlightFromConnector | TEventUnhighlightFromConnector,
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

  private changeNodeMode(
    action: TEventReduceNode | TEventExpandNode,
    gv: TGraphView,
    mode: 'REDUCED' | 'EXPANDED'
  ) {
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (node) {
      node.status.mode = mode;
    }
  }

  private resizeNode(
    action: TEventResizeNode,
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

  private resolveDrawnEdges(gv: TGraphView) {
    const groupId = (
      fromNode: string,
      fromConnector: string,
      toNode: string,
      toConnector: string
    ) => {
      return `${fromNode}::${fromConnector}--${toNode}::${toConnector}`;
    };

    const drawnEdges: TEdge[] = [];
    const edgesGroups: Map<string, TEdge> = new Map();

    for (const edge of gv.edges) {
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

    const allConnectorsHavingEdgesRendered = new Map<
      string,
      { nid: string; cn: string }
    >();

    gv.graph.edges.forEach((edge) => {
      const fromKey = `${edge.from.node}-${edge.from.connectorName}`;
      const toKey = `${edge.to.node}-${edge.to.connectorName}`;

      allConnectorsHavingEdgesRendered.set(fromKey, {
        nid: edge.from.node,
        cn: edge.from.connectorName,
      });
      allConnectorsHavingEdgesRendered.set(toKey, {
        nid: edge.to.node,
        cn: edge.to.connectorName,
      });
    });

    allConnectorsHavingEdgesRendered.forEach((con) => {
      const c = this.getConnectorView(gv, con.nid, con.cn);
      const incomingEdges = gv.graph.edges.filter(
        (edge) => edge.to.node === con.nid && edge.to.connectorName === con.cn
      );

      const outgoingEdges = gv.graph.edges.filter(
        (edge) =>
          edge.from.node === con.nid && edge.from.connectorName === con.cn
      );

      const edges = [...incomingEdges, ...outgoingEdges];

      c.incomingEdges = incomingEdges;
      c.outgoingEdges = outgoingEdges;
      c.edges = edges;
      c.noPinEdges = [
        ...incomingEdges.filter((e) => e.to.pinName === undefined),
        ...outgoingEdges.filter((e) => e.from.pinName === undefined),
      ];

      c.groupedEdgesCount = edges.reduce((prev, eg) => {
        if (eg.group) return prev + eg.group.edges.length;
        else return prev;
      }, 0);
    });
  }

  private updateGraphview(
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>
  ) {
    const nodesToRender = new Set<string>();
    const edgesToRender = new Set<TEdge>();

    const traverseFromNode = (nodeId: string, currentDepth: number) => {
      if (currentDepth > gv.params.maxRank) return;

      const node = gv.nodeViews.find((n) => n.id === nodeId);
      const isOpened = node && isNodeOpened(node?.status);
      const nodeEdges = edges.filter((e) => {
        return e.from.node === nodeId || e.to.node === nodeId;
      });

      if (!gv.params.filterOutNodes?.includes(nodeId)) {
        nodesToRender.add(nodeId);

        if (isOpened) {
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
      }
    };

    nodes.forEach((node) => {
      if (node.root) {
        traverseFromNode(node.id, 0);
      }
    });

    gv.edges = Array.from(edgesToRender);
    gv.graph.nodes = [];

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

  //

  newShape(g: Ra<TEventNewShape>) {
    g.dispatcher.process({
      type: 'core:new-node',
      nodeData: {
        name: `shape ${g.event.shapeId}`,
        root: true,
        id: g.event.shapeId,
        type: 'shape',
        data: {
          shapeType: g.event.shapeType,
          borderColor: '#672aa4',
          fillColor: '#672aa4',
          fillOpacity: 0,
        },
        connectors: [
          { connectorName: 'inputs', pins: [] },
          { connectorName: 'outputs', pins: [] },
        ],
      },
      edges: [],
      origin: g.event.origin,
    });
  }

  //

  newGroup(g: Ra<TEventNewGroup>) {
    g.dispatcher.process({
      type: 'core:new-node',
      nodeData: {
        name: `group ${g.event.title}`,
        root: true,
        id: g.event.groupId,
        type: 'group',
        data: { title: g.event.title },
        connectors: [
          { connectorName: 'inputs', pins: [] },
          { connectorName: 'outputs', pins: [] },
        ],
      },
      edges: [],
      origin: g.event.origin,
    });
  }

  //

  groupPropertyChange(g: Ra<TEventGroupPropertyChange>) {
    const node = g.sd.nodes.get(g.event.groupId);
    if (!node) {
      error('SPACE', `node ${g.event.groupId} not found`);
      return;
    }
    node.data = {
      ...node.data,
      ...g.event.properties,
    };
    g.sd.nodes.set(g.event.groupId, node);
  }

  //

  shapePropertyChange(g: Ra<TEventShapePropertyChange>) {
    const node = g.sd.nodes.get(g.event.shapeId);
    if (!node) {
      error('SPACE', `node ${g.event.shapeId} not found`);
      return;
    }
    node.data = {
      ...node.data,
      ...g.event.properties,
    };
    g.sd.nodes.set(g.event.shapeId, node);
  }

  //

  newNode(g: Ra<TEventNewNode>) {
    g.sd.graphViews.forEach((gv, k) => {
      gv.nodeViews.push({
        id: g.event.nodeData.id,
        type: g.event.nodeData.type,
        position:
          g.event.origin?.viewId === k && g.event.origin?.position
            ? g.event.origin?.position
            : { x: 0, y: 0 },
        status: nodeViewDefaultStatus(),
      });
    });
  }

  //

  newView(g: Ra<TEventNewView>) {
    const nv: TGraphView = defaultGraphView();
    g.sd.graphViews.set(g.event.viewId, nv);

    g.dispatcher.process({
      type: 'space:update-graph-view',
      viewId: g.event.viewId,
    });

    return Promise.resolve();
  }

  //

  updateAllGraphviews(g: Ra<ReducedEvents>) {
    g.sd.graphViews.forEach((gv, k) => {
      g.dispatcher.process({
        type: 'space:update-graph-view',
        viewId: k,
      });
    });
  }

  deleteShape(g: Ra<TEventDeleteShape>) {
    g.dispatcher.process({
      type: 'core:delete-node',
      id: g.event.shapeId,
    });
  }

  deleteGroup(g: Ra<TEventDeleteGroup>) {
    const { groupId } = g.event;

    // Before deleting the group, detach all child nodes and set their positions to absolute
    g.sd.graphViews.forEach((gv, viewId) => {
      // Find all nodes where parentId matches the group being deleted
      const childNodes = gv.nodeViews.filter(
        (node) => node.parentId === groupId
      );

      // For each child node, calculate absolute position and remove parentId
      childNodes.forEach((childNode) => {
        if (childNode.position) {
          // Calculate absolute position considering all parent groups
          const absolutePosition = getAbsolutePosition(
            childNode.position,
            groupId,
            gv
          );

          // Update node position to absolute and remove parent reference
          childNode.position = absolutePosition;
          delete childNode.parentId;
        }
      });
    });

    // Then delete the group node
    g.dispatcher.process({
      type: 'core:delete-node',
      id: groupId,
    });
  }
}
