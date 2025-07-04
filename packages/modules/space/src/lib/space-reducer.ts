import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import {
  TCoreEvent,
  TCoreSharedData,
  TEdge,
  TEventNewNode,
  TGraphNode,
} from '@monorepo/core';
import { error, UserException } from '@monorepo/log';
import { TJsonObject } from '@monorepo/simple-types';
import { makeProjectScopeString } from '@monorepo/demiurge-types';

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
  TEventEdgePropertyChange,
  TEventMoveNodeToFront,
  TEventMoveNodeToBack,
  TEventLockNode,
} from './space-events';
import {
  defaultGraphView,
  nodeViewDefaultStatus,
  TGraphView,
  connectorViewDefault,
  isNodeOpened,
  TNodeView,
} from './space-types';
import { getAbsolutePosition } from './utils/position-utils';
import { edgeId } from './components/apis/types/edge';

/**
 *
 */


type TExtraArgs = {
  project_id: string;
  user_id: string;
  jwt: {
    scope: string[]
  }
};


type ReducedEvents = TSpaceEvent | TCoreEvent;

type Ra<T> = ReduceArgs<
  TSpaceSharedData & TCoreSharedData,
  T,
  ReducedEvents,
  TExtraArgs
>;

/**
 *
 */

export class SpaceReducer extends Reducer<
  TSpaceSharedData & TCoreSharedData,
  ReducedEvents,
  TSpaceEvent,
  TExtraArgs
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

  private executeGraphViewActionIfUserHasPermission<T extends { viewId: string, nid: string }>(
    g: Ra<T>,
    action: (
      gvc: TGraphView,
      nodes: Map<string, TGraphNode>,
      edges: TEdge[]
    ) => void
  ): Promise<void> {

    const gv = g.sd.graphViews.get(g.event.viewId);
    if (!gv) {
      error('SPACE', `Graph view ${g.event.viewId} not found`);
      return Promise.resolve();
    }
    const nv = gv.nodeViews.find((n) => n.id === g.event.nid);
    if (!nv) {
      error('SPACE', `Node ${g.event.nid} not found in graph view`);
      return Promise.resolve();
    }

    let authorized = true;

    if (nv.lockedBy) {
      authorized = false;
      const nodeData = g.sd.nodes.get(g.event.nid);
      const admin = g.extraArgs.jwt.scope.includes(makeProjectScopeString(g.extraArgs.project_id, 'project:admin'));
      if (admin || nodeData?.data?.userId === g.extraArgs.user_id) {
        authorized = true;
      }
    }

    if (authorized) {
      return this.executeGraphViewAction(g, action);
    }
    else throw new UserException('You are not authorized to perform this action');
  }

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'space:new-view':
        return this.newView(g as Ra<TEventNewView>);

      case 'space:move-node':
        return this.executeGraphViewActionIfUserHasPermission(g as Ra<TEventMoveNode>, (gvc, nodes, edges) => {
          this.moveNode(g.event as TEventMoveNode, gvc, nodes, edges);
        });

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

      case 'space:edge-property-change':
        return (async () => {
          await this.edgePropertyChange(g as Ra<TEventEdgePropertyChange>);
          this.updateAllGraphviews(g);
        })();

      case 'space:move-node-to-front':
        return this.executeGraphViewAction(
          g as Ra<TEventMoveNodeToFront>,
          (gvc, nodes, edges) => {
            this.moveNodeToFront(g.event as TEventMoveNodeToFront, gvc);
          }
        );

      case 'space:move-node-to-back':
        return this.executeGraphViewAction(
          g as Ra<TEventMoveNodeToBack>,
          (gvc, nodes, edges) => {
            this.moveNodeToBack(g.event as TEventMoveNodeToBack, gvc);
          }
        );

      case 'space:lock-node':
        return this.executeGraphViewAction(
          g as Ra<TEventLockNode>,
          (gvc, nodes, edges) => {
            this.lockNode(g.event as TEventLockNode, gvc, nodes, edges, g.extraArgs.user_id);
          }
        );

      default:
        return Promise.resolve();
    }
  }

  private lockNode(action: TEventLockNode, gv: TGraphView,
    nodes: Readonly<Map<string, TGraphNode>>,
    edges: Readonly<Array<TEdge>>,
    user_id: string) {
    //
    const node = gv.nodeViews.find((n) => n.id === action.nid);
    if (!node) {
      error('SPACE', `Node ${action.nid} not found in graph view`);
      return;
    }
    node.lockedBy = user_id;
    this.updateGraphview(gv, nodes, edges);
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
        const parentIndex = gv.graph.nodes.findIndex((n) => n.id === node.parentId);
        if (parentIndex === -1) {
          error('SPACE', `Parent ${node.parentId} not found in graph view`);
          return;
        }

        if (nodeIndex - 1 <= parentIndex) {
          error('SPACE', `Node ${action.nid} cannot move before its parent ${node.parentId}`);
          return;
        }
      }
      // Move node one step backward
      const temp = gv.graph.nodes[nodeIndex];
      gv.graph.nodes[nodeIndex] = gv.graph.nodes[nodeIndex - 1];
      gv.graph.nodes[nodeIndex - 1] = temp;
    }
  }

  private moveDescendantsAfterGroup(groupId: string, groupIndex: number, gv: TGraphView) {
    // Get all direct children of the group
    const directChildren = gv.graph.nodes.filter((n) => n.parentId === groupId);

    // Collect all children that need to be moved (those before the group)
    const childrenToMove: Array<{ node: TNodeView; originalIndex: number }> = [];

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
      const childIndex = gv.graph.nodes.findIndex((n) => n.id === childrenToMove[i].node.id);
      gv.graph.nodes.splice(childIndex, 1);
    }

    // Insert children after the group in their original relative order
    for (let i = 0; i < childrenToMove.length; i++) {
      const insertIndex = groupIndex + 1 + i;
      gv.graph.nodes.splice(insertIndex, 0, childrenToMove[i].node);

      // If the child is also a group, recursively handle its descendants
      if (childrenToMove[i].node.type === 'group') {
        this.moveDescendantsAfterGroup(childrenToMove[i].node.id, insertIndex, gv);
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

  newShape(g: Ra<TEventNewShape>) {
    g.bep.process({
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
    g.bep.process({
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

  edgePropertyChange(g: Ra<TEventEdgePropertyChange>) {
    return g.st.transaction(async () => {
      let edge;
      let i;
      for (i = 0; i < g.sd.edges.length; i++) {
        if (edgeId(g.sd.edges.get(i)) === g.event.edgeId) {
          edge = g.sd.edges.get(i);
          break;
        }
      }
      if (!edge) {
        error('SPACE', `edge ${g.event.edgeId} not found`);
        return;
      }

      (edge as any).renderProps = g.event.properties.renderProps as TJsonObject;

      g.sd.edges.delete(i);
      g.sd.edges.push([edge]);
    });
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

    g.bep.process({
      type: 'space:update-graph-view',
      viewId: g.event.viewId,
    });

    return Promise.resolve();
  }

  //

  updateAllGraphviews(g: Ra<ReducedEvents>) {
    g.sd.graphViews.forEach((gv, k) => {
      g.bep.process({
        type: 'space:update-graph-view',
        viewId: k,
      });
    });
  }

  deleteShape(g: Ra<TEventDeleteShape>) {
    g.bep.process({
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
    g.bep.process({
      type: 'core:delete-node',
      id: groupId,
    });
  }
}
