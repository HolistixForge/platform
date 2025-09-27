# Layer System Architecture

## Overview

The layer system is a modular architecture that allows different rendering layers to coexist within the whiteboard, with proper viewport synchronization and activation management. This enables tools like Excalidraw to be integrated as separate layers while maintaining a unified user experience.

## Core Philosophy

### 1. **Modular Layer Architecture**

- Each tool (Excalidraw, future tools) becomes a separate module with its own layer
- Layers can be activated/deactivated independently
- Only one layer is active at a time for pointer events
- Base React Flow layer provides the foundation for node management

### 2. **Viewport Synchronization**

- All layers share the same viewport (pan, zoom, scroll)
- Two-way synchronization between host and layer components
- Real-time updates when users pan/zoom in any layer

### 3. **Node-Based Tool Integration**

- Tools like Excalidraw become React Flow nodes
- Each node can be edited individually
- Static rendering when inactive, full UI when active
- Seamless transition between editing and viewing modes

## Architecture Components

### 1. **Layer Context API**

```typescript
export type LayerContextValue = {
  activeLayerId: string | null;
  activeLayerPayload: any;
  activateLayer: (layerId: string, payload?: any) => void;
};
```

**Purpose**: Provides layer activation API to all components
**Scope**: Available throughout the whiteboard component tree
**Usage**: Allows nodes to activate their corresponding layers with payload data

### 2. **Layer Provider Interface**

```typescript
export type TLayerProvider = {
  id: string;
  title: string;
  zIndexHint?: number;
  Component: FC<LayerComponentProps & { payload?: any }>;
  onActivate?: (viewId: string) => void;
  onDeactivate?: (viewId: string) => void;
};
```

**Purpose**: Defines how modules contribute layers to the whiteboard
**Integration**: Modules export `layers` array in their `ModuleFrontend`
**Rendering**: Layers are rendered absolutely within the whiteboard container

### 3. **Viewport Adapter**

```typescript
export type LayerViewportAdapter = {
  onViewportChange: (viewport: LayerViewport) => void;
  registerViewportChangeCallback: (
    callback: (viewport: LayerViewport) => void
  ) => void;
  setViewport?: (viewport: LayerViewport) => void;
  getViewport?: () => LayerViewport;
};
```

**Purpose**: Enables two-way viewport synchronization
**Implementation**: Host manages viewport state, layers register for updates
**Benefits**: All layers stay in sync when user pans/zooms

## Implementation Details

### 1. **Layer Activation Flow**

```mermaid
graph TD
    A[User clicks Edit on ExcalidrawNode] --> B[activateLayer('excalidraw', {nodeId})]
    B --> C[LayerContext updates activeLayerId]
    C --> D[ExcalidrawNode hides itself]
    C --> E[Excalidraw layer activates with payload]
    E --> F[Layer loads specific drawing data]
    F --> G[User edits in Excalidraw layer]
    G --> H[Changes saved to shared data]
    H --> I[User deactivates layer]
    I --> J[ExcalidrawNode reappears with updated SVG]
```

### 2. **Data Flow Architecture**

```mermaid
graph LR
    A[React Flow Nodes] --> B[Layer Context]
    B --> C[Layer Activation]
    C --> D[Module Layers]
    D --> E[Shared Data]
    E --> F[Collaborative Updates]
    F --> G[SVG Export]
    G --> H[Node Display]
```

### 3. **Viewport Synchronization**

```typescript
// Host manages viewport state
const [viewport, setViewport] = useState({
  absoluteX: 0,
  absoluteY: 0,
  zoom: 1,
});

// Layers register for updates
viewport.registerViewportChangeCallback((newViewport) => {
  // Update layer's internal viewport
});

// Layers can also update host viewport
viewport.onViewportChange({ absoluteX: 100, absoluteY: 50, zoom: 1.5 });
```

## Module Integration

### 1. **Excalidraw Module Example**

```typescript
// Module exports layer provider
export const layers: TLayerProvider[] = [
  {
    id: 'excalidraw',
    title: 'Excalidraw',
    zIndexHint: 10,
    Component: ExcalidrawLayerComponent,
  },
];

// Module exports node component
export const moduleFrontend: ModuleFrontend = {
  nodes: {
    ExcalidrawNode,
  },
  spaceMenuEntries: excalidrawMenuEntries,
  layers,
};
```

### 2. **Node-Layer Coordination**

```typescript
// Node checks if it's being edited
const isBeingEdited =
  activeLayerId === 'excalidraw' && activeLayerPayload?.nodeId === id;

// Node hides when being edited
if (isBeingEdited) {
  return null;
}

// Layer receives payload with nodeId
const nodeId = payload?.nodeId || 'default';
```

### 3. **Shared Data Management**

```typescript
// Collaborative data structure
export type TExcalidrawDrawing = {
  elements: TJsonObject[];
  hash: string;
  svg: string;
};

// Debounced updates to prevent conflicts
const debouncedSetDrawing = useMemo(
  () =>
    debounce((elements, hash, svg) => {
      sharedData.excalidrawDrawing.set(nodeId, { elements, hash, svg });
    }, 250),
  [nodeId, sharedData]
);
```

## Key Benefits

### 1. **Modularity**

- Each tool is a separate module
- Easy to add/remove tools
- Independent development and testing
- Clean separation of concerns

### 2. **Performance**

- Lazy loading of heavy UI components
- Only active layer consumes resources
- Efficient viewport synchronization
- Debounced updates prevent conflicts

### 3. **User Experience**

- Seamless editing workflow
- Consistent viewport behavior
- Real-time collaboration
- Intuitive layer management

### 4. **Extensibility**

- Easy to add new tools
- Standardized integration pattern
- Reusable layer infrastructure
- Future-proof architecture

## Technical Challenges Solved

### 1. **Viewport Synchronization**

- **Problem**: Multiple layers need to stay in sync
- **Solution**: Centralized viewport state with adapter pattern
- **Result**: Smooth pan/zoom across all layers

### 2. **Node-Layer Coordination**

- **Problem**: Nodes need to hide when being edited
- **Solution**: Context-based activation with payload
- **Result**: Clean editing workflow

### 3. **Data Persistence**

- **Problem**: Collaborative data with conflict resolution
- **Solution**: Hash-based change detection with debouncing
- **Result**: Reliable real-time collaboration

### 4. **SVG Rendering**

- **Problem**: Infinite canvas vs. fixed node bounds
- **Solution**: Smart cropping and scaling
- **Result**: Natural-sized drawings in nodes

## Future Extensions

### 1. **Layer Tree UI**

- Visual layer management
- Reordering capabilities
- Visibility toggles
- Grouping support

### 2. **Additional Tools**

- Electronic schematic editor
- Miro-style whiteboard
- 3D modeling tools
- Video editing layers

### 3. **Advanced Features**

- Layer blending modes
- Custom viewport behaviors
- Layer-specific hotkeys
- Plugin architecture

## Best Practices

### 1. **Module Development**

- Always provide both node and layer components
- Use proper TypeScript types
- Implement proper cleanup
- Follow naming conventions

### 2. **Layer Implementation**

- Handle viewport synchronization
- Implement proper activation/deactivation
- Use debounced updates for performance
- Provide meaningful error handling

### 3. **Node Integration**

- Check layer context for activation state
- Implement proper hide/show logic
- Use consistent styling patterns
- Provide clear user feedback

## Conclusion

The layer system provides a robust foundation for integrating multiple tools within a unified whiteboard experience. By separating concerns, maintaining proper synchronization, and providing clear APIs, it enables both current functionality and future extensibility while maintaining excellent performance and user experience.
