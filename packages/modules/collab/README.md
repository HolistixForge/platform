# Collaboration Module

Provides real-time collaborative editing infrastructure using Yjs CRDT (Conflict-free Replicated Data Types) for distributed state synchronization.

## Features

- **Yjs Integration**: Server and client-side Yjs implementations for WebSocket-based collaboration
- **Shared Data Types**: Shared maps and arrays that automatically sync across all connected clients
- **Awareness System**: Tracks user presence, cursors, and selection states in real-time
- **Local Override**: Supports local state overrides for optimistic UI updates
- **No-Collab Mode**: Fallback mode for testing without collaboration infrastructure

## API

Backend exports a `Collab` instance that provides `loadSharedData` for registering shared maps and arrays. Frontend exports include React hooks for accessing shared data, awareness, and local overrides. Supports both Yjs server/client configurations and a no-collab mode for isolated testing.

## Dependencies

No dependencies - foundational module used by all other modules.

## Exports

- `TCollabBackendExports`: Backend collaboration interface
- `TCollabFrontendExports`: Frontend collaboration interface with React hooks
- `LocalOverrider`: Utility for local state overrides
- `TEventUserLeave`: Event type for user disconnection

