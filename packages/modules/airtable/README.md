# Airtable Module

Integration with Airtable API for embedding and interacting with Airtable bases and tables within the workspace.

## Features

- **Base Integration**: Connect to Airtable bases and display them as nodes
- **Search Functionality**: Search Airtable bases and display results
- **Node Views**: Custom views for Airtable content within graph nodes
- **Real-time Sync**: Airtable data synchronized through collaborative shared state

## API

Manages shared data for Airtable bases, node views, and search results. Processes Airtable events through reducers. Supports base connection, search operations, and view management.

## Dependencies

- `core-graph`: For graph node integration
- `collab`: For shared data synchronization
- `reducers`: For event processing

## Exports

- `TAirtableSharedData`: Type for Airtable shared data
- `TAirtableEvent`: Airtable event type definitions
- Airtable reducer for processing Airtable API operations

