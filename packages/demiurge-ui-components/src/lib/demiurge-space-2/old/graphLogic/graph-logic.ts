import {
  applyNodeChanges,
  Node as RfNode,
  Edge as RfEdge,
  NodeDragHandler,
} from 'reactflow';
import { Connection } from 'reactflow';

/**
 *
 */

type TGroupingStatus = {
  nodeId: string;
  status: { [connectorName: string]: boolean };
};

/**
 *
 */

type NodePayload = { id: string };

export type Node = Omit<RfNode, 'data'> & { data: NodePayload & any };

/**
 *
 */

export type SimpleEdgePayload = { type: 'simple' };

type EdgeGroupPayload = { type: 'group'; groupEdges: SimpleEdge[] };

export type SimpleEdge = Omit<RfEdge, 'data'> & { data: SimpleEdgePayload };

type EdgeGroup = Omit<RfEdge, 'data'> & { data: EdgeGroupPayload };

type Edge = SimpleEdge | EdgeGroup;

/**
 *
 */

export type THandleId = {
  nodeId: string;
  handleId: string;
};

/**
 *
 */

export abstract class GraphLogic {
  _updateFunction?: () => void;

  _update() {
    this._updateFunction?.();
  }

  _setUpdateFunction(updateFunction?: () => void) {
    this._updateFunction = updateFunction;
  }

  /** return react flow nodes array to be rendered */
  abstract getDrawnNodes(): Node[];
  /**   return react flow edges array to be rendered */
  abstract getDrawnEdges(): Edge[];

  /* use via hook useRfGraphContext() */

  abstract hilightEdges(hid: THandleId): void;
  abstract groupUngroup(nodeId: string, connectorName: string): void;
  abstract isGrouped(nodeId: string, connectorName: string): boolean;
  abstract getGroupedCount(nodeId: string, connectorName: string): number;
}

/**
 *
 *
 *
 *
 */

export class GraphLogicBase extends GraphLogic {
  _nodes: Node[] = [];
  _edges: SimpleEdge[] = [];
  _drawnEdges: Edge[] = [];
  _groupingStatus: TGroupingStatus[] = [];

  setNodesAndEdges(nodes: Node[], edges: SimpleEdge[]) {
    this._nodes = nodes;
    this._edges = edges;
    this._groupingStatus = this._nodes.map((node) => {
      const gs = this._groupingStatus.find((o) => o.nodeId === node.id);
      if (gs) return gs;
      else
        return {
          nodeId: node.id,
          status: { outputs: true, inputs: true },
        };
    });
    this._resolveDrawnEdges();
  }

  /**
   *
   */

  _resolveDrawnEdges = () => {
    //
    const drawnEdges: Edge[] = [];
    const edgesGroups: EdgeGroup[] = [];

    // for each edge
    for (let index = 0; index < this._edges.length; index++) {
      const copy = { ...this._edges[index] };

      const sourceEyeState =
        this._groupingStatus.find((state) => state.nodeId === copy.source)
          ?.status.outputs || false;
      const targetEyeState =
        this._groupingStatus.find((state) => state.nodeId === copy.target)
          ?.status.inputs || false;

      // draw only one link for a given source/target nodes
      if (sourceEyeState || targetEyeState) {
        let group = edgesGroups.find(
          (g) => g.source === copy.source && g.target === copy.target,
        );
        if (!group) {
          group = {
            type: 'custom',
            id: `edges-group_${copy.source}:${copy.target}`,
            source: copy.source,
            target: copy.target,
            className: 'edges-group',
            data: {
              type: 'group',
              groupEdges: [copy],
            },
          };
          edgesGroups.push(group);
        } else group.data.groupEdges.push(copy);
      }
      // no grouping: draw this edge normaly
      else drawnEdges.push(copy);
    }

    // we remove the group of 1 edge
    this._drawnEdges = [
      ...drawnEdges,
      ...edgesGroups.map((g) =>
        g.data.groupEdges.length > 1 ? g : g.data.groupEdges[0],
      ),
    ];
  };

  /**
   *
   */

  getDrawnNodes(): Node[] {
    return this._nodes;
  }

  /**
   *
   */

  getDrawnEdges(): Edge[] {
    return this._drawnEdges;
  }

  /**
   *
   */

  hilightEdges(hid: THandleId): void {
    this._edges = this._edges.map((e) => {
      e.className = '';
      e.className +=
        e.source === hid.nodeId && e.sourceHandle === hid.handleId
          ? 'source-highlighted'
          : '';
      e.className +=
        e.target === hid.nodeId && e.targetHandle === hid.handleId
          ? 'target-highlighted'
          : '';
      return e;
    });
    this._resolveDrawnEdges();
    this._update();
  }

  /**
   *
   */

  groupUngroup(nodeId: string, connectorName: string): void {
    this._groupingStatus = this._groupingStatus.map((state) => {
      if (state.nodeId === nodeId) {
        state.status[connectorName] = !state.status[connectorName];
      }
      return state;
    });
    this._resolveDrawnEdges();
    this._update();
  }

  /**
   *
   */

  isGrouped(nodeId: string, connectorName: string): boolean {
    const state = this._groupingStatus.find((state) => state.nodeId === nodeId);
    if (!state) return false;
    return state.status[connectorName];
  }

  /**
   *
   */

  getGroupedCount(nodeId: string, connectorName: string): number {
    // get the edges that end to this handle
    const edgesGroups =
      connectorName === 'inputs'
        ? this._drawnEdges.filter((e) => e.target === nodeId && !e.targetHandle)
        : this._drawnEdges.filter(
            (e) => e.source === nodeId && !e.sourceHandle,
          );

    // count the grouped edges and simple edge
    const groupedCount = edgesGroups.reduce((prev, eg) => {
      if (eg.data.type === 'group') return prev + eg.data.groupEdges.length;
      else return prev + 1;
    }, 0);

    return groupedCount;
  }
}

/**
 *
 *
 *
 *
 *
 */

export class StoryGraphLogic extends GraphLogicBase {
  _onConnect = (c: Connection): void => {
    const id = `${c.source}:${c.sourceHandle} -> ${c.target}:${c.targetHandle}`;
    this._edges.push({
      id,
      source: c.source as string,
      target: c.target as string,
      sourceHandle: c.sourceHandle,
      targetHandle: c.targetHandle,
      data: {
        type: 'simple',
      },
    });
    this._resolveDrawnEdges();
    this._update();
  };

  //

  _onNodeDrag: NodeDragHandler = (
    event: React.MouseEvent,
    node: Node,
    nodes: Node[],
  ) => {
    const { id, position, positionAbsolute, dragging } = node;
    this._nodes = applyNodeChanges(
      [{ type: 'position', id, position, positionAbsolute, dragging }],
      this._nodes,
    );
    this._update();
  };
}
