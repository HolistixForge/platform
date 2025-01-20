import { TEdge } from '../edge';

export type TEdgeMountData = { demiurge_type: 'mount' };
export type TEdgeChatAnchorData = { demiurge_type: 'chat-anchor' };
export type TEdgeTerminalData = { demiurge_type: 'terminal' };

export type TDemiurgeEdgeData = TEdgeMountData | TEdgeTerminalData;

export type TEdgeMount = TEdge<
  TEdgeMountData,
  undefined,
  { mount_point: string }
>;

export type TEdgeChatAnchor = TEdge<TEdgeChatAnchorData, undefined, undefined>;

export type TDemiurgeEdge = TEdge | TEdgeMount | TEdge<TEdgeTerminalData>;
