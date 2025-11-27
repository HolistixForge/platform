# Excalidraw Module

Integration with Excalidraw for collaborative whiteboard drawing within the workspace, using the space module's layer system.

## Features

- **Excalidraw Integration**: Full Excalidraw drawing capabilities as a layer
- **Layer System**: Integrates with space module's layer architecture
- **Collaborative Drawing**: Real-time synchronized drawing across all users
- **Drawing Persistence**: Drawing state stored in collaborative shared data

## API

Manages shared data for Excalidraw drawings. Integrates as a layer provider in the space module. Drawing state is synchronized through Yjs shared data. No reducers required - drawing operations handled directly through Excalidraw's collaborative features.

## Dependencies

- `collab`: For shared data synchronization (drawing state)

## Exports

- `TExcalidrawSharedData`: Type for Excalidraw shared data
- Excalidraw layer provider for space module integration

