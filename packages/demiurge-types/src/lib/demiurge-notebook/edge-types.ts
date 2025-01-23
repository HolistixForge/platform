export type TEdgeMountData = { demiurge_type: 'mount' };

export type TEdgeChatAnchorData = { demiurge_type: 'chat-anchor' };

export type TEdgeTerminalData = { demiurge_type: 'terminal' };

export type TDemiurgeEdgeData = TEdgeMountData | TEdgeTerminalData;
