import { RequestData, TReducersBackendExports } from '@holistix-forge/reducers';
import { ReducerWithCollab } from '@holistix-forge/collab';
import {
  TCoreEvent,
  TCoreSharedData,
  TEdge,
  TEventNewNode,
} from '@holistix-forge/core-graph';
import { TGraphNode } from '@holistix-forge/core-graph';
import { error, UserException, log, EPriority } from '@holistix-forge/log';
import { TJsonObject } from '@holistix-forge/simple-types';

import { TWhiteboardSharedData } from '../index';
import { TEventProjectInit } from '@holistix-forge/gateway';
import {
  TWhiteboardEvent,
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
  TEventEdgePropertyChange,
  TEventMoveNodeToFront,
  TEventMoveNodeToBack,
  TEventLockNode,
  TEventDisableFeature,
} from './whiteboard-events';
import {
  defaultGraphView,
  nodeViewDefaultStatus,
  TGraphView,
  connectorViewDefault,
  isNodeOpened,
  TNodeView,
} from './whiteboard-types';
import { getAbsolutePosition } from './utils/position-utils';
import { resolveNodeMove } from './utils/move-node-utils';
import { purgeDeletedNodeViews } from './utils/node-view-utils';
import { edgeId } from './whiteboard-edge-utils';
import { TCollabBackendExports } from '@holistix-forge/collab';
import { TGatewayExports } from '@holistix-forge/gateway';

/**
 *
 */

type ReducedEvents = TWhiteboardEvent | TCoreEvent | TEventProjectInit;

type RequiredExports = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
};

/**
 *
 */

export class WhiteboardReducer extends ReducerWithCollab<
  ReducedEvents,
  TWhiteboardSharedData & TCoreSharedData
> {
  //
  private depsExports: RequiredExports;

  constructor(depsExports: RequiredExports) {
    super(depsExports.collab.registry, 'whiteboard');
    this.depsExports = depsExports;
  }

  override reduce(
    event: ReducedEvents,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'project:init':
        return this._initProject(event, requestData);

      case 'whiteboard:new-view':
        return this.newView(event, requestData);

      case 'whiteboard:move-node':
        return this.executeGraphViewActionIfUserHasPermission(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.moveNode(event, gvc, nodes, edges);
          }
        );

      case 'whiteboard:reduce-node':
        return this.executeGraphViewAction(event, requestData, (gvc) => {
          this.changeNodeMode(event as TEventReduceNode, gvc, 'REDUCED');
        });

      case 'whiteboard:expand-node':
        return this.executeGraphViewAction(event, requestData, (gvc) => {
          this.changeNodeMode(event as TEventExpandNode, gvc, 'EXPANDED');
        });

      case 'whiteboard:close-connector':
      case 'whiteboard:open-connector':
        return this.executeGraphViewAction(event, requestData, (gvc) => {
          this.openCloseConnector(
            event as TEventCloseConnector | TEventOpenConnector,
            gvc
          );
        });

      case 'whiteboard:highlight':
        return this.executeGraphViewAction(event, requestData, (gvc) => {
          this.setEdgeHighlight(
            event as TEventHighlightFromConnector,
            gvc,
            true
          );
        });

      case 'whiteboard:unhighlight':
        return this.executeGraphViewAction(event, requestData, (gvc) => {
          this.setEdgeHighlight(
            event as TEventUnhighlightFromConnector,
            gvc,
            false
          );
        });

      case 'whiteboard:filter-out-node':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.filterOutNode(event as TEventFilterOutNode, gvc, nodes, edges);
          }
        );

      case 'whiteboard:unfilter-out-node':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.unfilterOutNode(
              event as TEventUnfilterOutNode,
              gvc,
              nodes,
              edges
            );
          }
        );

      case 'whiteboard:open-node':
      case 'whiteboard:close-node':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.openCloseNode(
              event as TEventOpenNode | TEventCloseNode,
              gvc,
              nodes,
              edges
            );
          }
        );

      case 'whiteboard:resize-node':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.resizeNode(event as TEventResizeNode, gvc, nodes, edges);
          }
        );

      case 'whiteboard:update-graph-view':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.updateGraphview(gvc, nodes, edges);
          }
        );

      case 'whiteboard:new-group':
        this.newGroup(event, requestData);
        return Promise.resolve();

      case 'whiteboard:new-shape':
        this.newShape(event, requestData);
        return Promise.resolve();

      case 'whiteboard:group-property-change':
        this.groupPropertyChange(event, requestData);
        return Promise.resolve();

      case 'whiteboard:shape-property-change':
        this.shapePropertyChange(event, requestData);
        return Promise.resolve();

      case 'whiteboard:delete-shape':
        this.deleteShape(event, requestData);
        return Promise.resolve();

      case 'whiteboard:delete-group':
        this.deleteGroup(event, requestData);
        return Promise.resolve();

      case 'core:delete-edge':
      case 'core:delete-node':
      case 'core:new-edge':
        this.updateAllGraphviews(event, requestData);
        return Promise.resolve();

      case 'core:new-node':
        this.newNode(event, requestData);
        this.updateAllGraphviews(event, requestData);
        return Promise.resolve();

      case 'whiteboard:edge-property-change':
        return (async () => {
          await this.edgePropertyChange(event, requestData);
          this.updateAllGraphviews(event, requestData);
        })();

      case 'whiteboard:move-node-to-front':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.moveNodeToFront(event, gvc);
          }
        );

      case 'whiteboard:move-node-to-back':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.moveNodeToBack(event, gvc);
          }
        );

      case 'whiteboard:lock-node':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.lockNode(event, gvc, nodes, edges, requestData.user_id);
          }
        );

      case 'whiteboard:disable-feature':
        return this.executeGraphViewAction(
          event,
          requestData,
          (gvc, nodes, edges) => {
            this.disableFeature(event, gvc);
          }
        );

      default:
        return Promise.resolve();
    }
  }

  private executeGraphViewAction<T extends { viewId: string }>(
    event: T,
    requestData: RequestData,
    action: (
      gvc: TGraphView,
      nodes: Map<string, TGraphNode>,
      edges: TEdge[]
    ) => void
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const viewId = event.viewId;
    const gv = collab.sharedData['whiteboard:graphViews'].get(viewId);
    if (!gv) {
      error('SPACE', `Graph view ${viewId} not found`);
      return Promise.resolve();
    }

    const gvc = structuredClone(gv);
    const nodes = collab.sharedData['core-graph:nodes'] as unknown as Map<
      string,
      TGraphNode
    >;
    const edges = collab.sharedData['core-graph:edges'] as unknown as TEdge[];

    action(gvc, nodes, edges);
    collab.sharedData['whiteboard:graphViews'].set(viewId, gvc);
    return Promise.resolve();
  }

  private executeGraphViewActionIfUserHasPermission<
    T extends { viewId: string; nid: string }
  >(
    event: T,
    requestData: RequestData,
    action: (
      gvc: TGraphView,
      nodes: Map<string, TGraphNode>,
      edges: TEdge[]
    ) => void
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const gv = collab.sharedData['whiteboard:graphViews'].get(event.viewId);
    if (!gv) {
      error('SPACE', `Graph view ${event.viewId} not found`);
      return Promise.resolve();
    }
    const nv = gv.nodeViews.find((n: TNodeView) => n.id === event.nid);
    if (!nv) {
      error('SPACE', `Node ${event.nid} not found in graph view`);
      return Promise.resolve();
    }

    let authorized = true;

    if (nv.lockedBy) {
      authorized = false;
      const nodeData = collab.sharedData['core-graph:nodes'].get(event.nid);
      const jwt = requestData.jwt as { project_id?: string };
      const project_id = jwt?.project_id;
      let admin = false;
      if (project_id) {
        const permissionManager = this.depsExports.gateway.permissionManager;
        admin =
          permissionManager.hasPermission(
            requestData.user_id,
            `project:${project_id}:admin`
          ) ||
          permissionManager.hasPermission(requestData.user_id, 'org:admin') ||
          permissionManager.hasPermission(requestData.user_id, 'org:owner');
      }
      if (admin || nodeData?.data?.userId === requestData.user_id) {
        authorized = true;
      }
    }

    if (authorized) {
      return this.executeGraphViewAction(event, requestData, action);
    } else
      throw new UserException('You are not authorized to perform this action');
  }

  private lockNode(
    action: TEventLockNode,
    gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>,
    user_id: string
  ) {
    //
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (!node) {
      error('SPACE', `Node ${action.nid} not found in graph view`);
      return;
    }
    node.lockedBy = user_id;
    this.updateGraphview(gv, nodes, edges);
  }

  private disableFeature(action: TEventDisableFeature, gv: TGraphView) {
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (!node) {
      error('SPACE', `Node ${action.nid} not found in graph view`);
      return;
    }

    if (!node.disabledFeatures) {
      node.disabledFeatures = [];
    }

    if (!node.disabledFeatures.includes(action.feature)) {
      node.disabledFeatures.push(action.feature);
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

    node.status.forceOpened = action.type === 'whiteboard:open-node';
    node.status.forceClosed =
      action.type === 'whiteboard:open-node' ? false : true;
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

    if (action.position) {
      const node = gv.nodeViews.find((n) => n.id === action.nid);
      if (!node) {
        error('SPACE', `Node ${action.nid} not found in graph view`);
        return;
      }
      delete node.parentId;
      node.position = action.position;
    }

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
    c.isOpened = action.type === 'whiteboard:close-connector' ? false : true;
    this.resolveDrawnEdges(gv);
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

    // Check if the node has disabled features
    if (node.disabledFeatures?.includes('backend-move-node')) {
      error('SPACE', `Node ${action.nid} cannot be moved (feature disabled)`);
      return;
    }

    const { position, parentId } = resolveNodeMove(
      gv,
      node,
      action.position,
      !!action.stop
    );

    node.position = position;
    if (parentId) node.parentId = parentId;
    else delete node.parentId;

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
        const groupEdge = edgesGroups.get(id);

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
            semanticType: 'grouped_edges',
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
    // `nodes` is a SharedMap cast to Map: it has `get`, but no `has`.
    purgeDeletedNodeViews(gv, (id) => nodes.get(id) !== undefined);

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

    // Helper function to get all parent IDs for a node (recursively)
    const getAllParentIds = (nodeId: string): string[] => {
      const parentIds: string[] = [];
      let currentNodeId = nodeId;

      while (true) {
        const nodeView = gv.nodeViews.find((n) => n.id === currentNodeId);
        if (!nodeView?.parentId) break;

        parentIds.push(nodeView.parentId);
        currentNodeId = nodeView.parentId;
      }

      return parentIds.reverse(); // Return in order from root to immediate parent
    };

    // Helper function to ensure a node and all its parents are added in correct order
    const addNodeWithParents = (nodeId: string, addedNodes: Set<string>) => {
      const parentIds = getAllParentIds(nodeId);

      // Add all parents first (if not already added and in nodesToRender)
      for (const parentId of parentIds) {
        if (nodesToRender.has(parentId) && !addedNodes.has(parentId)) {
          let parentNode = gv.nodeViews.find((n) => n.id === parentId);
          if (!parentNode) {
            parentNode = {
              id: parentId,
              type: nodes.get(parentId)?.type || 'unknown',
              position: { x: 0, y: 0 },
              status: nodeViewDefaultStatus(),
            };
            gv.nodeViews.push(parentNode);
          }
          gv.graph.nodes.push(parentNode);
          addedNodes.add(parentId);
        }
      }

      // Add the current node if not already added
      if (!addedNodes.has(nodeId)) {
        let n = gv.nodeViews.find((n) => n.id === nodeId);
        if (!n) {
          n = {
            id: nodeId,
            type: nodes.get(nodeId)?.type || 'unknown',
            position: { x: 0, y: 0 },
            status: nodeViewDefaultStatus(),
          };
          gv.nodeViews.push(n);
        }
        gv.graph.nodes.push(n);
        addedNodes.add(nodeId);
      }
    };

    // Track which nodes have been added to avoid duplicates
    const addedNodes = new Set<string>();

    // Process all nodes to render, ensuring proper parent-child order
    nodesToRender.forEach((nodeId) => {
      addNodeWithParents(nodeId, addedNodes);
    });

    this.resolveDrawnEdges(gv);
  }

  private moveNodeToFront(action: TEventMoveNodeToFront, gv: TGraphView) {
    const nodeIndex = gv.graph.nodes.findIndex((n) => n.id === action.nid);
    if (nodeIndex === -1) {
      error('SPACE', `Node ${action.nid} not found in graph view`);
      return;
    }
    // Move node one step forward if not at the end
    if (nodeIndex < gv.graph.nodes.length - 1) {
      // move to front means move towards the end of the array

      const node = gv.graph.nodes[nodeIndex];
      const isGroup = node.type === 'group';

      const temp = gv.graph.nodes[nodeIndex];
      gv.graph.nodes[nodeIndex] = gv.graph.nodes[nodeIndex + 1];
      gv.graph.nodes[nodeIndex + 1] = temp;

      // If the node is a group and we moved it forward, ensure all its descendants
      // appear after it in the array
      if (isGroup && nodeIndex < gv.graph.nodes.length - 1) {
        const movedNodeIndex = nodeIndex + 1; // New position after moving forward
        this.moveDescendantsAfterGroup(action.nid, movedNodeIndex, gv);
      }
    }
  }

  private moveNodeToBack(action: TEventMoveNodeToBack, gv: TGraphView) {
    const nodeIndex = gv.graph.nodes.findIndex((n) => n.id === action.nid);
    if (nodeIndex === -1) {
      error('SPACE', `Node ${action.nid} not found in graph view`);
      return;
    }
    if (nodeIndex > 0) {
      // move to back means move towards the beginning of the array

      const node = gv.graph.nodes[nodeIndex];
      const hasParent = !!node.parentId;

      // If node is in a group, it can't come before its parent
      if (hasParent) {
        const parentIndex = gv.graph.nodes.findIndex(
          (n) => n.id === node.parentId
        );
        if (parentIndex === -1) {
          error('SPACE', `Parent ${node.parentId} not found in graph view`);
          return;
        }

        if (nodeIndex - 1 <= parentIndex) {
          error(
            'SPACE',
            `Node ${action.nid} cannot move before its parent ${node.parentId}`
          );
          return;
        }
      }
      // Move node one step backward
      const temp = gv.graph.nodes[nodeIndex];
      gv.graph.nodes[nodeIndex] = gv.graph.nodes[nodeIndex - 1];
      gv.graph.nodes[nodeIndex - 1] = temp;
    }
  }

  private moveDescendantsAfterGroup(
    groupId: string,
    groupIndex: number,
    gv: TGraphView
  ) {
    // Get all direct children of the group
    const directChildren = gv.graph.nodes.filter((n) => n.parentId === groupId);

    // Collect all children that need to be moved (those before the group)
    const childrenToMove: Array<{ node: TNodeView; originalIndex: number }> =
      [];

    for (const child of directChildren) {
      const childIndex = gv.graph.nodes.findIndex((n) => n.id === child.id);
      if (childIndex < groupIndex) {
        childrenToMove.push({ node: child, originalIndex: childIndex });
      }
    }

    // Sort by original index to preserve relative order
    childrenToMove.sort((a, b) => a.originalIndex - b.originalIndex);

    // Remove children from their current positions (in reverse order to maintain indices)
    for (let i = childrenToMove.length - 1; i >= 0; i--) {
      const childIndex = gv.graph.nodes.findIndex(
        (n) => n.id === childrenToMove[i].node.id
      );
      gv.graph.nodes.splice(childIndex, 1);
    }

    // Insert children after the group in their original relative order
    for (let i = 0; i < childrenToMove.length; i++) {
      const insertIndex = groupIndex + 1 + i;
      gv.graph.nodes.splice(insertIndex, 0, childrenToMove[i].node);

      // If the child is also a group, recursively handle its descendants
      if (childrenToMove[i].node.type === 'group') {
        this.moveDescendantsAfterGroup(
          childrenToMove[i].node.id,
          insertIndex,
          gv
        );
      }
    }

    // Handle children that are already after the group but are groups themselves
    for (const child of directChildren) {
      const childIndex = gv.graph.nodes.findIndex((n) => n.id === child.id);
      if (childIndex > groupIndex && child.type === 'group') {
        this.moveDescendantsAfterGroup(child.id, childIndex, gv);
      }
    }
  }

  //

  newShape(event: TEventNewShape, requestData: RequestData) {
    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          name: `shape ${event.shapeId}`,
          root: true,
          id: event.shapeId,
          type: 'shape',
          data: {
            shapeType: event.shapeType,
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
        origin: event.origin,
      },
      requestData
    );
  }

  //

  newGroup(event: TEventNewGroup, requestData: RequestData) {
    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          name: `group ${event.title}`,
          root: true,
          id: event.groupId,
          type: 'group',
          data: { title: event.title },
          connectors: [
            { connectorName: 'inputs', pins: [] },
            { connectorName: 'outputs', pins: [] },
          ],
        },
        edges: [],
        origin: event.origin,
      },
      requestData
    );
  }

  //

  groupPropertyChange(
    event: TEventGroupPropertyChange,
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    const node = collab.sharedData['core-graph:nodes'].get(event.groupId);
    if (!node) {
      error('SPACE', `node ${event.groupId} not found`);
      return;
    }
    node.data = {
      ...node.data,
      ...event.properties,
    };
    collab.sharedData['core-graph:nodes'].set(event.groupId, node);
  }

  //

  shapePropertyChange(
    event: TEventShapePropertyChange,
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    const node = collab.sharedData['core-graph:nodes'].get(event.shapeId);
    if (!node) {
      error('SPACE', `node ${event.shapeId} not found`);
      return;
    }
    node.data = {
      ...node.data,
      ...event.properties,
    };
    collab.sharedData['core-graph:nodes'].set(event.shapeId, node);
  }

  //

  edgePropertyChange(
    event: TEventEdgePropertyChange,
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    return collab.sharedTypes.transaction(async () => {
      let edge;
      let i;
      for (i = 0; i < collab.sharedData['core-graph:edges'].length; i++) {
        if (
          edgeId(collab.sharedData['core-graph:edges'].get(i)) === event.edgeId
        ) {
          edge = collab.sharedData['core-graph:edges'].get(i);
          break;
        }
      }
      if (!edge) {
        error('SPACE', `edge ${event.edgeId} not found`);
        return;
      }

      (edge as unknown as { renderProps: TJsonObject }).renderProps = event
        .properties.renderProps as TJsonObject;

      collab.sharedData['core-graph:edges'].delete(i);
      collab.sharedData['core-graph:edges'].push([edge]);
    });
  }

  //

  newNode(event: TEventNewNode, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    collab.sharedData['whiteboard:graphViews'].forEach(
      (gv: TGraphView, k: string) => {
        const gvc = structuredClone(gv);
        gvc.nodeViews.push({
          id: event.nodeData.id,
          type: event.nodeData.type,
          position:
            event.origin?.viewId === k && event.origin?.position
              ? event.origin?.position
              : { x: 0, y: 0 },
          status: nodeViewDefaultStatus(),
        });
        collab.sharedData['whiteboard:graphViews'].set(k, gvc);
      }
    );
  }

  //

  newView(event: TEventNewView, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    const nv: TGraphView = defaultGraphView();
    collab.sharedData['whiteboard:graphViews'].set(event.viewId, nv);

    this.depsExports.reducers.processEvent(
      {
        type: 'whiteboard:update-graph-view',
        viewId: event.viewId,
      },
      requestData
    );

    return Promise.resolve();
  }

  //

  updateAllGraphviews(event: ReducedEvents, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    collab.sharedData['whiteboard:graphViews'].forEach(
      (gv: TGraphView, k: string) => {
        this.depsExports.reducers.processEvent(
          {
            type: 'whiteboard:update-graph-view',
            viewId: k,
          },
          requestData
        );
      }
    );
  }

  deleteShape(event: TEventDeleteShape, requestData: RequestData) {
    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.shapeId,
      },
      requestData
    );
  }

  deleteGroup(event: TEventDeleteGroup, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    const { groupId } = event;

    // Before deleting the group, detach all child nodes and set their positions to absolute
    collab.sharedData['whiteboard:graphViews'].forEach(
      (gv: TGraphView, viewId: string) => {
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
      }
    );

    // Then delete the group node
    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: groupId,
      },
      requestData
    );
  }

  /**
   * Initialize project with default whiteboard view
   * Called when a new project is created
   */
  private async _initProject(
    event: TEventProjectInit,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const graphViews = collab.sharedData['whiteboard:graphViews'];

    const currentSize = graphViews.copy().size;
    log(
      EPriority.Info,
      'WHITEBOARD_INIT',
      `project:init called for project ${event.project_id}, current graphViews size: ${currentSize}`
    );

    // Check if already initialized (idempotent)
    if (currentSize > 0) {
      log(
        EPriority.Info,
        'WHITEBOARD_INIT',
        `Skipping initialization - graphViews already has ${currentSize} view(s)`
      );
      return;
    }

    // Create default view
    const viewId = 'view-1';
    const newView: TGraphView = defaultGraphView();

    graphViews.set(viewId, newView);
    log(
      EPriority.Info,
      'WHITEBOARD_INIT',
      `✅ Created default graphView '${viewId}' for project ${event.project_id}`
    );
  }
}
