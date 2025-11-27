# Tabs Module

Tab management system for organizing and navigating multiple views, resources, and panels within the workspace interface.

## Features

- **Tab Organization**: Hierarchical tab structure with tree-based navigation
- **Tab Persistence**: Tabs stored in collaborative shared data
- **Panel System**: Integration with panel components for tab content
- **Read-only Tree**: Utility for displaying tab hierarchy
- **Tab Limits**: Maximum row configuration for tab layout

## API

Manages shared data for tabs as a map. Provides `TabsRadix` component for tab UI. Exports `ReadOnlyTree` for displaying tab hierarchy. Supports tab paths and payload types. Frontend and backend module definitions available.

## Dependencies

- `core-graph`: For graph integration
- `collab`: For shared data synchronization
- `reducers`: For event processing (backend)

## Exports

- `TTabsSharedData`: Type for tabs shared data
- `TTabsTree`: Tab tree structure type
- `TabPayload`, `TabPath`: Tab data types
- `TabsRadix`: Tab UI component
- `ReadOnlyTree`: Tree display component
- `MAX_TAB_ROW`: Maximum tab row constant
- `TTabEvents`: Tab event type definitions

