//
import { TEdge } from '@monorepo/core';
import { TNodeView } from '../../space-types';

export type TFunc<TN, TE> = (
  node: TN,
  edge: TE | undefined,
  rank: number
) => boolean;

export const graphTraversal = <TN, TE>(
  nodes: Array<TN>,
  edges: Array<TE>,
  getNode: (nodes: Array<TN>, id: string) => TN | undefined,
  getEdges: (edges: Array<TE>, nid: string) => Array<TE>,
  getEdgeOtherEndId: (e: TE, nid: string) => string,
  doContinue: TFunc<TN, TE>,
  roots: string[]
) => {
  //
  const result = {
    nodes: Array<TN>(),
    edges: Array<TE>(),
    ranks: new Map<string, number>(),
  };

  const recurse = (
    currNodeId: string,
    edge: TE | undefined = undefined,
    rank = 0
  ) => {
    //
    // console.log(currNodeId, edge, rank);
    let continu = true;
    const n = getNode(nodes, currNodeId);
    if (n) {
      const lastRank = result.ranks.get(currNodeId);
      // if encountered this node yet
      if (lastRank !== undefined) {
        // if encountered but at a higher rank, update the rank
        if (lastRank > rank) result.ranks.set(currNodeId, rank);
        // else no need to continue beyond this node
        else continu = false;
      }
      // else, first time
      else {
        result.nodes.push(n);
        result.ranks.set(currNodeId, rank);
      }

      if (edge && !result.edges.find((e) => Object.is(e, edge)))
        result.edges.push(edge);

      continu = continu && doContinue(n, edge, rank);

      if (continu) {
        const nodeEdges = getEdges(edges, currNodeId);
        nodeEdges.forEach((ne) => {
          const otherNodeId = getEdgeOtherEndId(ne, currNodeId);
          recurse(otherNodeId, ne, rank + 1);
        });
      }
    }
  };

  roots.forEach((root) => recurse(root));

  return result;
};

//
//
//

export const getNodeEdges = (edges: Array<TEdge>, nid: string) =>
  edges.filter((edge) => edge.from.node === nid || edge.to.node === nid);

//
//

export const viewGraphTraversal = (
  nodes: Array<TNodeView>,
  edges: Array<TEdge>,
  processEdge: (
    node: TNodeView,
    edge: TEdge | undefined,
    rank: number
  ) => boolean,
  roots: string[]
) => {
  const getNode = (nodes: Array<TNodeView>, id: string) =>
    nodes.find((node) => node.id === id);

  const getEdgeOtherEndId = (edge: TEdge, nid: string) =>
    edge.from.node === nid ? edge.to.node : edge.from.node;

  return graphTraversal<TNodeView, TEdge>(
    nodes,
    edges,
    getNode,
    getNodeEdges,
    getEdgeOtherEndId,
    processEdge,
    roots
  );
};
