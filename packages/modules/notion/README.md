# Notion Module

Integration with Notion API for embedding and interacting with Notion databases and pages within the workspace.

## Features

- **Database Integration**: Connect to Notion databases and display them as nodes
- **Search Functionality**: Search Notion databases and display results
- **Node Views**: Custom views for Notion content within graph nodes
- **Real-time Sync**: Notion data synchronized through collaborative shared state

## API

Manages shared data for Notion databases, node views, and search results. Processes Notion events through reducers. Supports database connection, search operations, and view management.

## Dependencies

- `core-graph`: For graph node integration
- `collab`: For shared data synchronization
- `reducers`: For event processing

## Exports

- `TNotionSharedData`: Type for Notion shared data
- `TNotionEvent`: Notion event type definitions
- Notion reducer for processing Notion API operations

