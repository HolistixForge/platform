# Core Graph Module

Foundation for the graph-based workspace, providing nodes, edges, and connectors as the base building blocks for all visual elements.

## Features

- **Graph Structure**: Nodes and edges that form the visual graph representation
- **Connectors**: Input/output pins on nodes for creating connections
- **Edge Types**: Semantic edge types for different relationship categories
- **Position Management**: 2D positioning system for nodes in the workspace
- **Graph Hooks**: React hooks for accessing node edges and relationships

## API

Manages shared data for nodes (map) and edges (array). Provides TypeScript types for nodes, edges, connectors, and pins. Events include node/edge creation and deletion. The `useNodeEdges` hook allows components to access edges connected to specific nodes.

## Dependencies

- `collab`: For shared data synchronization
- `reducers`: For event processing

## Exports

- `TCoreSharedData`: Type for core graph shared data
- `TGraphNode`, `TEdge`, `TConnector`, `TPin`: Core graph type definitions
- `TPosition`, `EEdgeSemanticType`: Supporting types
- `useNodeEdges`: React hook for accessing node edges
- Event types: `TEventNewNode`, `TEventDeleteNode`, `TEventNewEdge`, `TEventDeleteEdge`

