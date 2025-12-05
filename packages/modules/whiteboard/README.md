# Whiteboard Module

Whiteboard and workspace management system with multi-view support, layer architecture, and visual elements like groups and shapes.

## Features

- **Graph Views**: Multiple named views of the graph workspace with independent viewport states
- **Layer System**: Modular layer architecture supporting multiple rendering layers (React Flow base + module layers)
- **Visual Elements**: Groups and shapes for organizing and annotating the workspace
- **Viewport Synchronization**: Shared pan/zoom state across all layers
- **Node Views**: Per-node view configurations for different display modes
- **Feature Controls**: Enable/disable features per view or globally

## API

Manages shared data for graph views. Provides registration APIs for menu entries, custom nodes, layers, and panels. Exports the main `Whiteboard` component and layer context hooks. Supports node locking and feature toggling per view.

## Dependencies

- `core-graph`: For graph structure
- `gateway`: For gateway services
- `collab`: For shared data
- `reducers`: For event processing

## Exports

- `TWhiteboardSharedData`: Type for space shared data
- `TGraphView`, `TNodeView`: View type definitions
- `Whiteboard`: Main whiteboard component
- `useLayerContext`: Hook for layer activation
- Registration functions: `registerMenuEntries`, `registerNodes`, `registerLayer`, `registerPanel`
- Event types: `TEventNewView`, `TEventNewGroup`, `TEventNewShape`, `TEventLockNode`

